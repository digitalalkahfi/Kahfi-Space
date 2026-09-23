/** Level akun 0–8 dan jejak perubahannya. */
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
const { uji, jalankan } = buatSuite("Level akun");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const A = {
  skincare: (
    await satu(`select id from accounts where username='@skincare_official'`)
  ).id,
  beauty: (
    await satu(`select id from accounts where username='@beauty_daily.id'`)
  ).id,
  fashion: (
    await satu(`select id from accounts where username='@fashion_hijab'`)
  ).id,
};
const U = {
  farhan: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
};

uji("level hanya menerima 0-8", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(db, `update accounts set level = 9 where id = $1`, [
        A.skincare,
      ]),
    "level 9 seharusnya ditolak",
  );
  await harusDitolak(
    () =>
      sebagaiAdmin(db, `update accounts set level = -1 where id = $1`, [
        A.skincare,
      ]),
    "level negatif seharusnya ditolak",
  );
});

uji("level menunjuk acuan yang ada di tabel referensi", async () => {
  await sebagaiAdmin(db, `update accounts set level = 4 where id = $1`, [
    A.skincare,
  ]);
  const b = await satu(
    `select batas_minimum(a.level) as minimum
       from accounts a where a.id = $1`,
    [A.skincare],
  );
  harusSama(b.minimum, 10, "level 4 berarti minimum 10 unggahan");
});

uji("tiap perubahan level meninggalkan jejak dari-ke", async () => {
  // Level awalnya dibaca dari seed, bukan ditulis di sini: seed boleh
  // berganti angka tanpa membuat tes ini ikut merah. Seed juga sudah
  // membawa riwayatnya sendiri, jadi yang diperiksa hanya jejak yang
  // ditinggalkan oleh dua perubahan di bawah ini.
  const awal = await satu(`select level from accounts where id = $1`, [
    A.beauty,
  ]);
  const sebelumnya = await satu(
    `select count(*)::int as n from account_level_events where account_id = $1`,
    [A.beauty],
  );
  await sebagaiAdmin(db, `update accounts set level = 2 where id = $1`, [
    A.beauty,
  ]);
  await sebagaiAdmin(db, `update accounts set level = 6 where id = $1`, [
    A.beauty,
  ]);
  const { rows } = await sebagaiAdmin(
    db,
    `select dari, ke from account_level_events
      where account_id = $1 order by created_at`,
    [A.beauty],
  );
  harusSama(
    rows.slice(sebelumnya.n).map((r) => [r.dari, r.ke]),
    [
      [awal.level, 2],
      [2, 6],
    ],
  );
  harusSama(
    rows[sebelumnya.n - 1].ke,
    awal.level,
    "jejaknya nyambung: baris terakhir seed berakhir di level sekarang",
  );
});

uji("menetapkan level yang sama tidak menambah jejak", async () => {
  const sebelum = await satu(
    `select count(*)::int as n from account_level_events where account_id=$1`,
    [A.beauty],
  );
  await sebagaiAdmin(db, `update accounts set level = 6 where id = $1`, [
    A.beauty,
  ]);
  const sesudah = await satu(
    `select count(*)::int as n from account_level_events where account_id=$1`,
    [A.beauty],
  );
  harusSama(
    sesudah.n,
    sebelum.n,
    "tidak ada perubahan berarti tidak ada jejak",
  );
});

uji("pelaku perubahan ikut tercatat", async () => {
  await sebagai(db, U.farhan, `update accounts set level = 7 where id = $1`, [
    A.fashion,
  ]);
  const b = await satu(
    `select ke, oleh_id from account_level_events
      where account_id = $1 order by created_at desc limit 1`,
    [A.fashion],
  );
  harusSama(b.ke, 7);
  harusSama(b.oleh_id, U.farhan);
});

uji("jejak level tidak bisa disunting", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(db, `update account_level_events set ke = 0 where ke = 7`),
    "jejak level seharusnya tidak bisa disunting",
  );
});

uji("pengguna biasa tidak bisa menghapus jejak level", async () => {
  // Penghapusan langsung ditutup RLS (tabelnya tanpa policy delete);
  // yang boleh lewat hanya cascade saat akunnya sendiri dihapus.
  const sebelum = await satu(
    `select count(*)::int as n from account_level_events`,
  );
  await sebagai(db, U.farhan, `delete from account_level_events`);
  const sesudah = await satu(
    `select count(*)::int as n from account_level_events`,
  );
  harusSama(sesudah.n, sebelum.n, "tidak ada baris yang boleh hilang");
  harus(sebelum.n > 0);
});

uji("akun tanpa level tetap sah, minimumnya null", async () => {
  // Akun baru sengaja dibuat di sini: seluruh akun seed sudah berlevel,
  // sedangkan yang diuji justru akun yang levelnya belum ditetapkan.
  // `level = null` ditulis eksplisit karena sejak migrasi 0150 kolomnya
  // punya default 0 — akun baru tidak lagi lahir tanpa standar.
  await sebagaiAdmin(
    db,
    `insert into accounts (username, unit_id, status, level)
     select '@uji_tanpa_level', u.id, 'aktif', null
       from units u where u.kode='affiliator'`,
  );
  const b = await satu(
    `select a.level, batas_minimum(a.level) as minimum
       from accounts a where a.username = '@uji_tanpa_level'`,
  );
  harusSama(b.level, null);
  harusSama(b.minimum, null, "tanpa level tidak ada standar yang berlaku");
});

uji("menghapus akun ikut menghapus riwayat levelnya", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `insert into accounts (username, unit_id, status, level)
     select '@uji_level', u.id, 'aktif', 1 from units u where u.kode='affiliator'
     returning id`,
  );
  const id = rows[0].id;
  harusSama(
    (
      await satu(
        `select count(*)::int as n from account_level_events where account_id=$1`,
        [id],
      )
    ).n,
    1,
    "akun yang lahir berlevel punya baris awal",
  );
  await sebagaiAdmin(db, `delete from accounts where id = $1`, [id]);
  harusSama(
    (
      await satu(
        `select count(*)::int as n from account_level_events where account_id=$1`,
        [id],
      )
    ).n,
    0,
  );
});

uji("ubah_level_akun menulis alasan ke jejaknya", async () => {
  await sebagai(db, U.farhan, `select ubah_level_akun($1,6::smallint,$2)`, [
    A.fashion,
    "Naik kelas setelah tiga bulan melewati minimum",
  ]);

  const b = await satu(
    `select dari, ke, alasan, oleh_id from account_level_events
      where account_id = $1 order by created_at desc limit 1`,
    [A.fashion],
  );
  harusSama(b.ke, 6);
  harusSama(b.alasan, "Naik kelas setelah tiga bulan melewati minimum");
  harusSama(b.oleh_id, U.farhan, "pelakunya ikut tercatat");
  harusSama(
    (await satu(`select level from accounts where id = $1`, [A.fashion])).level,
    6,
  );
});

uji("alasan wajib dan tidak boleh sekadar sepatah kata", async () => {
  // Jejak yang tidak menjelaskan apa pun sama saja dengan tidak ada
  // jejak: berbulan-bulan kemudian tidak ada yang bisa menilai apakah
  // kenaikan itu wajar.
  for (const alasan of ["", "   ", "naik"]) {
    await harusDitolak(
      () =>
        sebagai(db, U.farhan, `select ubah_level_akun($1,3::smallint,$2)`, [
          A.fashion,
          alasan,
        ]),
      `alasan ${JSON.stringify(alasan)} harus ditolak`,
    );
  }
});

uji("menyetel level yang sama ditolak, bukan diam-diam lolos", async () => {
  // Kalau lolos, ia akan terbaca sebagai "sudah diubah" padahal tidak
  // ada yang berubah — dan jejaknya pun tidak bertambah.
  await harusDitolak(() =>
    sebagai(db, U.farhan, `select ubah_level_akun($1,6::smallint,$2)`, [
      A.fashion,
      "Mencoba menyetel ke angka yang sama",
    ]),
  );
});

uji("akun yang tidak ada ditolak", async () => {
  await harusDitolak(() =>
    sebagai(
      db,
      U.farhan,
      `select ubah_level_akun('00000000-0000-0000-0000-000000000000'::uuid,
                               1::smallint, $1)`,
      ["Akun ini memang tidak pernah ada"],
    ),
  );
});

uji("alasannya tidak bocor ke perubahan berikutnya", async () => {
  // `set_config(..., true)` berlaku lokal transaksi. Kalau suatu saat
  // dibuat global, alasan perubahan sebelumnya akan menempel pada
  // perubahan berikutnya yang dilakukan lewat update biasa.
  await sebagai(db, U.farhan, `select ubah_level_akun($1,4::smallint,$2)`, [
    A.fashion,
    "Disesuaikan ulang setelah evaluasi kuartal",
  ]);
  await sebagaiAdmin(db, `update accounts set level = 5 where id = $1`, [
    A.fashion,
  ]);

  const b = await satu(
    `select ke, alasan from account_level_events
      where account_id = $1 order by created_at desc limit 1`,
    [A.fashion],
  );
  harusSama(b.ke, 5);
  harusSama(b.alasan, "", "perubahan tanpa alasan tetap tanpa alasan");
});

uji("akun baru lahir dengan level terendah, bukan tanpa standar", async () => {
  // Migrasi 0150: default 0. Yang lupa mengisi level tetap punya lantai,
  // dan tidak ada akun aktif yang diam-diam tidak dinilai.
  const { rows } = await sebagaiAdmin(
    db,
    `insert into accounts (username, unit_id, status)
     select '@uji_default_level', u.id, 'aktif'
       from units u where u.kode='affiliator'
     returning id, level`,
  );
  harusSama(rows[0].level, 0);
  harusSama(
    (
      await satu(`select batas_minimum(level) as b from accounts where id=$1`, [
        rows[0].id,
      ])
    ).b,
    3,
    "level 0 berarti minimum 3 unggahan",
  );
});

uji("tidak ada akun aktif yang tertinggal tanpa level", async () => {
  // Hasil backfill migrasi 0150. Kalau suatu saat ada jalan baru yang
  // membuat akun aktif tanpa level, tes ini yang gagal lebih dulu.
  // Akun buatan berkas tes ini dikecualikan: salah satunya memang
  // sengaja dibuat tanpa level untuk menguji keadaan itu.
  harusSama(
    (
      await satu(
        `select count(*)::int as n from accounts
          where status='aktif' and level is null
            and username not like '@uji\\_%'`,
      )
    ).n,
    0,
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
