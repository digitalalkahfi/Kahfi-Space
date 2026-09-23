/**
 * Seluruh permukaan migrasi hanya boleh disentuh Owner/Manager.
 *
 * Isinya data pribadi seluruh karyawan lama — nama, surel, nomor
 * telepon, kehadiran, dan penghasilan. Satu tabel yang lupa dipasangi
 * RLS membuka semuanya untuk siapa pun yang punya akun, tanpa satu pun
 * galat yang memberi tahu.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("RLS ekspor lama");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const peran = async (nama) =>
  (await satu(`select id, nama from users where role = $1 and status = 'aktif' limit 1`, [nama]));

const U = {
  ceo: await peran("CEO"),
  manager: await peran("Manager"),
  finance: await peran("Finance"),
  leader: await peran("Leader"),
  staff: await peran("Staff"),
};

/** Tabel yang menampung atau menemani data sistem lama. */
const TABEL = [
  "kv_store_lama",
  "kv_unggahan",
  "migrasi_peta",
  "migrasi_orang_pending",
  "migrasi_jalan",
  "migrasi_catatan",
  "migrasi_persetujuan",
];

uji("mengisi satu baris pada tiap tabel migrasi", async () => {
  await sebagaiAdmin(
    db,
    `insert into kv_unggahan (berkas, jumlah_kunci, jumlah_entri, oleh)
     values ('uji.json', 1, 1, $1)`,
    [U.manager.id],
  );
  await sebagaiAdmin(
    db,
    `insert into kv_store_lama (key, value) values ('users:list', '[{"id":"u1"}]'::jsonb)`,
  );
  await sebagaiAdmin(
    db,
    `insert into migrasi_peta (kelompok, id_lama, id_baru, tabel)
     values ('users:list', 'usr_001', $1, 'users')`,
    [U.staff.id],
  );
  await sebagaiAdmin(
    db,
    `insert into migrasi_orang_pending (id_lama, nama) values ('usr_404', 'Entah')`,
  );
  await sebagaiAdmin(
    db,
    `select mulai_migrasi_jalan('uji_coba'::tahap_migrasi)`,
  );
  const jalan = (await satu(`select id from migrasi_jalan order by dimulai_pada desc limit 1`)).id;
  await sebagaiAdmin(
    db,
    `insert into migrasi_catatan (jalan_id, entitas, kunci_lama, status)
     values ($1, 'users:list', 'users:list:usr_001', 'berhasil')`,
    [jalan],
  );
  await sebagaiAdmin(
    db,
    `insert into migrasi_persetujuan (entitas, versi, disetujui_oleh, pemetaan)
     values ('users:list', 'abcd1234', $1, '{}'::jsonb)`,
    [U.manager.id],
  );

  for (const t of TABEL) {
    const { rows } = await sebagaiAdmin(db, `select count(*)::int n from ${t}`);
    harus(Number(rows[0].n) > 0, `${t} harus terisi untuk diuji`);
  }
});

uji("CEO dan Manager melihat isinya", async () => {
  for (const orang of [U.ceo, U.manager]) {
    for (const t of TABEL) {
      const { rows } = await sebagai(
        db,
        orang.id,
        `select count(*)::int n from ${t}`,
      );
      harus(
        Number(rows[0].n) > 0,
        `${orang.nama} seharusnya bisa membaca ${t}`,
      );
    }
  }
});

uji("Finance, Leader, dan Staff tidak melihat apa pun", async () => {
  // Finance melihat angka lintas unit, tetapi ini bukan angka — ini
  // berkas pribadi orang.
  for (const orang of [U.finance, U.leader, U.staff]) {
    for (const t of TABEL) {
      // Persetujuan pemetaan memang boleh dibaca siapa saja yang berhak
      // melihat layar migrasi; yang lain tidak.
      const { rows } = await sebagai(
        db,
        orang.id,
        `select count(*)::int n from ${t}`,
      );
      harusSama(
        Number(rows[0].n),
        0,
        `${orang.nama} seharusnya tidak melihat isi ${t}`,
      );
    }
  }
});

uji("bukan Owner/Manager tidak bisa menulis apa pun", async () => {
  const tulis = {
    kv_store_lama: `insert into kv_store_lama (key, value) values ('curian:x', '[]'::jsonb)`,
    kv_unggahan: `insert into kv_unggahan (berkas) values ('curian.json')`,
    migrasi_peta: `insert into migrasi_peta (kelompok, id_lama, id_baru, tabel) values ('users:list', 'x', gen_random_uuid(), 'users')`,
    migrasi_orang_pending: `insert into migrasi_orang_pending (id_lama) values ('usr_curian')`,
  };

  for (const orang of [U.finance, U.leader, U.staff]) {
    for (const [tabel, sql] of Object.entries(tulis)) {
      await harusDitolak(
        () => sebagai(db, orang.id, sql),
        `${orang.nama} seharusnya tidak bisa menulis ke ${tabel}`,
      );
    }
  }
});

uji("fungsi pembacanya ikut terkunci, bukan menembus RLS", async () => {
  // Fungsi yang dibuat security definer akan membocorkan seluruh isi
  // tabel lewat pintu belakang; yang di sini sengaja hak pemanggil.
  const staf = await sebagai(db, U.staff.id, `select * from ringkas_kunci_lama()`);
  harusSama(staf.rows.length, 0);

  const medan = await sebagai(db, U.staff.id, `select * from medan_kunci_lama()`);
  harusSama(medan.rows.length, 0);

  const manajer = await sebagai(db, U.manager.id, `select * from ringkas_kunci_lama()`);
  harus(manajer.rows.length > 0, "Manager harus tetap melihat isinya");
});

uji("tiap tabel migrasi mengaktifkan RLS dan punya kebijakan", async () => {
  // Penjaga untuk tabel yang ditambahkan belakangan: tabel baru tanpa
  // RLS tidak menimbulkan galat apa pun, ia hanya terbuka.
  const { rows } = await sebagaiAdmin(
    db,
    `select c.relname tabel, c.relrowsecurity rls,
            (select count(*) from pg_policies p
              where p.schemaname = 'public' and p.tablename = c.relname)::int kebijakan
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and (c.relname like 'migrasi%' or c.relname like 'kv_%' or c.relname = 'kspace_lama_log')
      order by c.relname`,
  );

  harus(rows.length >= TABEL.length, "tabel migrasi harus terbaca");
  for (const r of rows) {
    harus(r.rls, `${r.tabel} belum mengaktifkan RLS`);
    harus(r.kebijakan > 0, `${r.tabel} tidak punya satu pun kebijakan`);
  }
});

uji("fungsi jalur migrasi tertutup untuk seluruh peran selain CEO/Manager", async () => {
  // Fungsi security definer menembus RLS; kalau penjagaan perannya
  // lupa, ia menjadi pintu belakang ke seluruh tabel tujuan.
  for (const orang of [U.finance, U.leader, U.staff]) {
    for (const panggilan of [
      `select migrasi_tulis_kehadiran($1, date '2023-03-01', 'hadir'::status_kehadiran)`,
      `select migrasi_tulis_laporan($1, date '2023-03-01', null, null, 1000)`,
      `select migrasi_tulis_transaksi(date '2023-03-01', 'masuk'::arah_transaksi, null::jenis_keluar, 1, 'x')`,
      `select bersihkan_peta_menggantung()`,
    ]) {
      await harusDitolak(
        () => sebagai(db, orang.id, panggilan, panggilan.includes("$1") ? [orang.id] : []),
        `${orang.nama} seharusnya ditolak: ${panggilan.slice(7, 40)}`,
      );
    }
  }
});

uji("CEO dan Manager sama-sama boleh memakai jalur migrasi", async () => {
  // Kalau hanya salah satunya, migrasi berhenti setiap kali orang yang
  // berhak sedang tidak ada.
  for (const orang of [U.ceo, U.manager]) {
    const { rows } = await sebagai(
      db,
      orang.id,
      `select migrasi_tulis_kehadiran($1, date '2023-03-02', 'hadir'::status_kehadiran) id`,
      [U.staff.id],
    );
    harus(rows[0].id !== null, `${orang.nama} harus bisa memakai jalurnya`);
    await sebagaiAdmin(db, `delete from attendance where id = $1`, [rows[0].id]);
  }
});

uji("peran yang dicabut kehilangan aksesnya seketika", async () => {
  // Hak dibaca dari peran saat itu juga, bukan dari sesi yang sudah
  // terbuka — orang yang turun peran tidak boleh tetap bisa menulis.
  const semula = (
    await satu(`select role from users where id = $1`, [U.manager.id])
  ).role;

  // Diturunkan ke Finance, bukan Staff: Staff aktif wajib punya unit,
  // dan Manager tidak punya — yang diuji perannya, bukan kendala unitnya.
  await sebagaiAdmin(db, `update users set role = 'Finance' where id = $1`, [
    U.manager.id,
  ]);
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.manager.id,
        `insert into kv_store_lama (key, value) values ('uji:cabut', '[]'::jsonb)`,
      ),
    "peran yang dicabut seharusnya kehilangan akses",
  );

  await sebagaiAdmin(db, `update users set role = $2 where id = $1`, [
    U.manager.id,
    semula,
  ]);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
