/**
 * View tren kepatuhan tiga hari.
 *
 * Yang dijaga di sini bukan angkanya saja, tapi tiga keputusan desain
 * yang mudah tergeser saat view-nya disentuh lagi: "tiga hari terakhir"
 * berarti tiga HARI KERJA, arah dibaca ujung ke ujung, dan view ini ikut
 * aturan baca pemanggilnya — bukan membocorkan akun orang lain.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Tren kepatuhan tiga hari");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
  dimas: (await satu(`select id from users where nama='Dimas Maulana'`)).id,
  farhan: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
};
const A = {
  skincare: (
    await satu(`select id from accounts where username='@skincare_official'`)
  ).id,
};

// Akun baru dengan PIC yang absensinya dikosongkan lebih dulu: seluruh
// akun seed kini punya tiga hari kerja, jadi keadaan "baru satu hari"
// tidak bisa dipinjam dari mana pun dan harus disusun sendiri. PIC-nya
// wajib pengguna aktif yang seunit dengan akunnya — keduanya dijaga
// trigger, jadi tidak bisa sembarang orang.
const U_SEPI = (await satu(`select id from users where nama='Bayu Nugraha'`))
  .id;
await sebagaiAdmin(db, `delete from attendance where user_id = $1`, [U_SEPI]);
const A_SEPI = (
  await sebagaiAdmin(
    db,
    `insert into accounts (username, unit_id, status, level, pic_user_id)
     select '@uji_sehari', u.id, 'aktif', 1, $1 from units u where u.kode='affiliator'
     returning id`,
    [U_SEPI],
  )
).rows[0].id;

const hadir = (userId, tanggal) =>
  sebagaiAdmin(
    db,
    `insert into attendance (user_id, tanggal, jam_masuk)
     values ($1,$2,(($2::date + time '08:00') at time zone 'Asia/Jakarta'))
     on conflict (user_id, tanggal) do update set jam_masuk = excluded.jam_masuk`,
    [userId, tanggal],
  );

const lapor = (akunId, tanggal, upload) =>
  sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, jumlah_upload)
     values ($1,$2,$3,1000000,$4)
     on conflict (account_id, tanggal) where account_id is not null
     do update set jumlah_upload = excluded.jumlah_upload`,
    [U.rian, tanggal, akunId, upload],
  );

/** Baris view untuk sebuah akun, dibaca sebagai orang yang berhak. */
const tren = async (akunId, userId = U.farhan) =>
  (
    await sebagai(
      db,
      userId,
      `select * from tren_kepatuhan_tiga_hari where account_id = $1`,
      [akunId],
    )
  ).rows[0];

// Level 3 → minimum 10. Empat hari kerja dengan satu jurang kalender di
// tengahnya: 11 & 12 November dilewati tanpa absensi sama sekali.
await sebagaiAdmin(db, `update accounts set level = 3 where id = $1`, [
  A.skincare,
]);
for (const t of ["2024-11-07", "2024-11-08", "2024-11-13", "2024-11-14"]) {
  await hadir(U.rian, t);
}
await lapor(A.skincare, "2024-11-07", 20);
await lapor(A.skincare, "2024-11-08", 4);
await lapor(A.skincare, "2024-11-13", 6);
// 14 November sengaja tidak dilaporkan.

uji(
  "yang diambil tiga hari kerja terakhir, bukan tiga hari kalender",
  async () => {
    const b = await tren(A.skincare);
    harusSama(b.hari_dinilai, 3);
    harusSama(
      b.tanggal.map((t) => new Date(t).toISOString().slice(0, 10)),
      ["2024-11-08", "2024-11-13", "2024-11-14"],
      "7 November tergeser keluar; 11 & 12 tidak pernah masuk",
    );
  },
);

uji(
  "hari kerja tanpa laporan tetap masuk deret dengan unggahan null",
  async () => {
    const b = await tren(A.skincare);
    harusSama(b.unggahan, [4, 6, null], "bukan nol; memang tidak ada laporan");
    harusSama(b.terpenuhi, [false, false, false]);
    harusSama(b.jumlah_terpenuhi, 0);
  },
);

uji("arah dibaca ujung ke ujung", async () => {
  // 4 → 6 → (tidak lapor = 0): ujung terakhir lebih rendah dari ujung awal.
  harusSama((await tren(A.skincare)).arah, "turun");

  await lapor(A.skincare, "2024-11-14", 9);
  harusSama((await tren(A.skincare)).arah, "naik", "4 → 9 tetap naik");

  await lapor(A.skincare, "2024-11-14", 4);
  harusSama((await tren(A.skincare)).arah, "datar", "6 di tengah diabaikan");
});

uji("beruntun kurang hanya menghitung ekornya", async () => {
  await lapor(A.skincare, "2024-11-08", 12);
  await lapor(A.skincare, "2024-11-13", 3);
  await lapor(A.skincare, "2024-11-14", 3);
  harusSama((await tren(A.skincare)).beruntun_kurang, 2);

  await lapor(A.skincare, "2024-11-14", 10);
  harusSama(
    (await tren(A.skincare)).beruntun_kurang,
    0,
    "tepat di batas sudah memenuhi, jadi ekornya bersih",
  );
});

uji("satu hari kerja saja belum punya arah", async () => {
  await hadir(U_SEPI, "2024-11-20");
  const b = await tren(A_SEPI);
  harusSama(b.hari_dinilai, 1);
  harusSama(b.arah, null, "tanpa dua hari, tidak ada tren yang bisa dibaca");
});

uji("akun tanpa level tidak punya minimum dan tidak berbeban", async () => {
  await sebagaiAdmin(db, `update accounts set level = null where id = $1`, [
    A_SEPI,
  ]);
  const b = await tren(A_SEPI);
  harusSama(b.minimum, null);
  harusSama(b.terpenuhi, [false], "tanpa standar tidak ada yang terpenuhi");
  harusSama(b.beruntun_kurang, 0, "juga tidak ada yang dilanggar");
});

uji("akun tanpa hari kerja sama sekali tetap muncul", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `insert into accounts (username, unit_id, status, level)
     select '@uji_tren', u.id, 'aktif', 2 from units u where u.kode='affiliator'
     returning id`,
  );
  const b = await tren(rows[0].id);
  harus(b !== undefined, "akun tanpa PIC pun harus terdaftar");
  harusSama(b.hari_dinilai, 0);
  harusSama(b.tanggal, null);
  harusSama(b.arah, null);
  harusSama(b.beruntun_kurang, 0);
});

uji("view ikut aturan baca pemanggilnya", async () => {
  const milikSendiri = await sebagai(
    db,
    U.rian,
    `select username from tren_kepatuhan_tiga_hari order by username`,
  );
  harus(
    milikSendiri.rows.every((r) =>
      ["@skincare_official", "@beauty_daily.id"].includes(r.username),
    ),
    "Staff hanya melihat akun yang ia pegang",
  );

  const manajemen = await sebagai(
    db,
    U.farhan,
    `select count(*)::int as n from tren_kepatuhan_tiga_hari`,
  );
  harus(
    manajemen.rows[0].n > milikSendiri.rows.length,
    "Manager melihat lebih banyak daripada satu PIC",
  );
});

await jalankan();
