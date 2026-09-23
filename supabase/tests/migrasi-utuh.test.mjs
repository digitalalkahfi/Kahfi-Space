/**
 * Rantai migrasi dari ujung ke ujung, di tingkat basis data.
 *
 * Tiap bagiannya sudah diuji sendiri-sendiri. Yang diuji di sini
 * sambungannya: ekspor masuk, orangnya tertaut, barisnya ditulis lewat
 * jalur migrasi, dan menjalankannya lagi tidak menggandakan apa pun.
 * Kegagalan sambungan tidak pernah muncul di uji satuan.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  idNama,
  muatEkspor,
  petakanOrang,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Migrasi utuh");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  manajer: await idNama(db, "Farhan Pratama"),
  rian: await idNama(db, "Rian Hidayat"),
};

uji("ekspor masuk sebagai satu baris per kunci", async () => {
  await muatEkspor(db, {
    "users:list": [
      { id: "usr_010", name: "Rian Hidayat", email: "rian@contoh.id" },
    ],
    "attendance:all": [
      { id: "att_010", userId: "usr_010", date: "2023-02-01", status: "hadir" },
    ],
  });

  const { rows } = await sebagai(
    db,
    U.manajer,
    `select kunci, jumlah from ringkas_kunci_lama() where kunci in ('users:list','attendance:all') order by kunci`,
  );
  harusSama(rows.length, 2);
  harusSama(rows.find((r) => r.kunci === "users:list").jumlah, 1);
});

uji("orang lama tertaut, dan rujukannya bisa dicari", async () => {
  await petakanOrang(db, "usr_010", U.rian);
  harusSama((await satu(`select orang_v1('usr_010') id`)).id, U.rian);
});

uji("kehadiran lama masuk lewat jalur migrasi dan tertandai", async () => {
  const hadir = await sebagai(
    db,
    U.manajer,
    `select migrasi_tulis_kehadiran(orang_v1('usr_010'), date '2023-02-01',
       'hadir'::status_kehadiran) id`,
  );
  const id = hadir.rows[0].id;
  harus(id !== null, "kehadiran harus tercatat");

  await sebagai(
    db,
    U.manajer,
    `insert into migrasi_peta (kelompok, id_lama, id_baru, tabel)
     values ('attendance:all', 'att_010', $1, 'attendance')
     on conflict (kelompok, id_lama) do update set id_baru = excluded.id_baru`,
    [id],
  );

  const b = await satu(
    `select catatan_bukti, user_id from attendance where id = $1`,
    [id],
  );
  harus(b.catatan_bukti !== "", "asal buktinya harus tertulis");
  harusSama(b.user_id, U.rian);
});

uji("menjalankannya lagi tidak menggandakan apa pun", async () => {
  const sebelum = await satu(
    `select count(*)::int n from attendance where user_id = $1 and tanggal = date '2023-02-01'`,
    [U.rian],
  );

  // Persis yang dikerjakan mesin migrasi pada unggahan kedua.
  await sebagai(
    db,
    U.manajer,
    `select migrasi_tulis_kehadiran(orang_v1('usr_010'), date '2023-02-01',
       'terlambat'::status_kehadiran)`,
  );

  const sesudah = await satu(
    `select count(*)::int n, max(status::text) status from attendance
      where user_id = $1 and tanggal = date '2023-02-01'`,
    [U.rian],
  );
  harusSama(sesudah.n, sebelum.n);
  // Barisnya sama, isinya diperbarui.
  harusSama(sesudah.status, "terlambat");
  harusSama(
    (await satu(`select count(*)::int n from migrasi_peta where kelompok='attendance:all'`)).n,
    1,
  );
});

uji("ringkasan jalannya tercatat dan bisa dibaca kembali", async () => {
  const jalan = (
    await sebagai(
      db,
      U.manajer,
      `select (mulai_migrasi_jalan('uji_coba'::tahap_migrasi)).id id`,
    )
  ).rows[0].id;

  await sebagai(
    db,
    U.manajer,
    `insert into migrasi_ringkas (jalan_id, kelompok, diperiksa, ditulis, tertahan)
     values ($1, 'attendance:all', 1, 1, 0)`,
    [jalan],
  );

  const { rows } = await sebagai(
    db,
    U.manajer,
    `select * from ringkas_jalan_kelompok($1)`,
    [jalan],
  );
  harusSama(rows[0].kelompok, "attendance:all");
  harusSama(rows[0].ditulis, 1);
});

uji("tidak ada peta yang menggantung setelah seluruhnya berjalan", async () => {
  const { rows } = await sebagai(db, U.manajer, `select * from peta_menggantung()`);
  harusSama(rows.length, 0);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
