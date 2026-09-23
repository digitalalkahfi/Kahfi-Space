/**
 * Pengelolaan departemen, unit, dan program.
 *
 * Yang dijaga: hanya manajemen yang boleh mengubah susunan organisasi,
 * nama departemen tetap unik, kode unit tidak bisa dikarang, dan
 * mengganti nama tidak memutus penempatan siapa pun.
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
const { uji, jalankan } = buatSuite("Kelola organisasi");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  farhan: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
  dewi: (await satu(`select id from users where nama='Dewi Lestari'`)).id,
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
};

uji("manajemen boleh menambah departemen", async () => {
  await sebagai(db, U.farhan, `insert into departments (nama) values ($1)`, [
    "Konten Kreatif",
  ]);
  harus(
    (await satu(`select id from departments where nama='Konten Kreatif'`)) !==
      undefined,
    "departemennya tersimpan",
  );
});

uji("nama departemen tetap unik", async () => {
  await harusDitolak(() =>
    sebagai(db, U.farhan, `insert into departments (nama) values ($1)`, [
      "Konten Kreatif",
    ]),
  );
});

uji("Leader dan Staff tidak bisa mengubah susunan", async () => {
  for (const id of [U.dewi, U.rian]) {
    const { rows } = await sebagai(
      db,
      id,
      `insert into departments (nama) values ('Coba Saja') returning id`,
    ).catch(() => ({ rows: [] }));
    harusSama(rows.length, 0, "insert-nya tidak menghasilkan baris");
  }
  harusSama(
    (
      await satu(
        `select count(*)::int as n from departments where nama='Coba Saja'`,
      )
    ).n,
    0,
  );
});

uji("mengganti nama departemen tidak memutus penempatan", async () => {
  // Inilah sebabnya nama diubah di baris yang sama, bukan dengan membuat
  // baris baru: anggota menunjuk id, bukan namanya.
  const dep = await satu(`select id, nama from departments where nama='MCN'`);
  const sebelum = await satu(
    `select count(*)::int as n from users where department_id=$1`,
    [dep.id],
  );
  harus(sebelum.n > 0, "seed harus punya anggota di departemen MCN");

  await sebagai(db, U.farhan, `update departments set nama=$2 where id=$1`, [
    dep.id,
    "MCN & Kreator",
  ]);

  const sesudah = await satu(
    `select count(*)::int as n from users where department_id=$1`,
    [dep.id],
  );
  harusSama(sesudah.n, sebelum.n, "jumlah anggotanya tidak berubah");
  harusSama(
    (await satu(`select nama from departments where id=$1`, [dep.id])).nama,
    "MCN & Kreator",
  );
});

uji("kode unit tidak bisa dikarang", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.farhan,
        `insert into units (kode, nama) values ('keuangan','Keuangan')`,
      ),
    "hanya affiliator, mcn, dan tap yang sah",
  );
});

uji("nama tampilan unit boleh berubah, kodenya tetap", async () => {
  await sebagai(
    db,
    U.farhan,
    `update units set nama=$1, deskripsi=$2 where kode='tap'`,
    ["TAP (Agency Partner)", "Kemitraan agensi TikTok"],
  );
  const u = await satu(
    `select kode, nama, deskripsi from units where kode='tap'`,
  );
  harusSama(u.kode, "tap", "kodenya tidak ikut berubah");
  harusSama(u.nama, "TAP (Agency Partner)");
  harus(u.deskripsi.length > 0);
});

uji("program menempel pada unit dan uniknya per unit", async () => {
  const mcn = await satu(`select id from units where kode='mcn'`);
  const aff = await satu(`select id from units where kode='affiliator'`);

  // Nama yang sama di unit berbeda memang dua hal berbeda — seed sudah
  // membuktikannya: "Reguler" ada di ketiga unit.
  harusSama(
    (await satu(`select count(*)::int as n from programs where nama='Reguler'`))
      .n,
    3,
  );

  await sebagai(
    db,
    U.farhan,
    `insert into programs (nama, unit_id) values ('Kelas Malam', $1)`,
    [mcn.id],
  );
  await sebagai(
    db,
    U.farhan,
    `insert into programs (nama, unit_id) values ('Kelas Malam', $1)`,
    [aff.id],
  );

  // Tapi tidak boleh dua kali di unit yang sama.
  await harusDitolak(() =>
    sebagai(
      db,
      U.farhan,
      `insert into programs (nama, unit_id) values ('Kelas Malam', $1)`,
      [mcn.id],
    ),
  );
});

uji("program dinonaktifkan, bukan dihapus", async () => {
  // Akun dan anggota yang pernah memakainya tetap menunjuk baris ini.
  const p = await satu(`select id from programs where nama='Mabit Scholar'`);
  const pemakai = await satu(
    `select count(*)::int as n from accounts where program_id=$1`,
    [p.id],
  );

  await sebagai(db, U.farhan, `update programs set aktif=false where id=$1`, [
    p.id,
  ]);

  harusSama(
    (
      await satu(
        `select count(*)::int as n from accounts where program_id=$1`,
        [p.id],
      )
    ).n,
    pemakai.n,
    "akun yang memakainya tidak ikut kehilangan programnya",
  );
  harusSama(
    (await satu(`select aktif from programs where id=$1`, [p.id])).aktif,
    false,
  );
});

uji(
  "memindahkan akun antar unit melepas PIC, co-leader, dan program",
  async () => {
    // Ketiganya menempel pada unit lama dan dijaga trigger (migrasi 0038 &
    // 0061). Memindahkan unit tanpa melepasnya akan ditolak database —
    // jadi endpoint-nya melepasnya secara sadar, dan tes ini yang menjaga
    // bahwa "secara sadar" itu tetap berlaku.
    const akun = await satu(
      `select id, unit_id, pic_user_id, program_id
       from accounts where username='@skincare_official'`,
    );
    harus(akun.pic_user_id !== null, "seed harus punya PIC");

    const mcn = await satu(`select id from units where kode='mcn'`);
    await harusDitolak(
      () =>
        sebagai(db, U.farhan, `update accounts set unit_id=$2 where id=$1`, [
          akun.id,
          mcn.id,
        ]),
      "pindah unit tanpa melepas PIC harus ditolak",
    );

    await sebagai(
      db,
      U.farhan,
      `update accounts
        set unit_id=$2, pic_user_id=null, co_leader_id=null, program_id=null
      where id=$1`,
      [akun.id, mcn.id],
    );

    const sesudah = await satu(
      `select unit_id, pic_user_id, program_id from accounts where id=$1`,
      [akun.id],
    );
    harusSama(sesudah.unit_id, mcn.id);
    harusSama(sesudah.pic_user_id, null, "PIC lama tidak ikut pindah");
    harusSama(sesudah.program_id, null, "program lama pun tidak ikut");
  },
);

uji("akun yang sudah pindah tidak bisa menunjuk PIC unit lama", async () => {
  const akun = await satu(
    `select id from accounts where username='@skincare_official'`,
  );
  await harusDitolak(
    () =>
      sebagai(db, U.farhan, `update accounts set pic_user_id=$2 where id=$1`, [
        akun.id,
        U.rian,
      ]),
    "Rian Affiliator bukan warga unit MCN",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
