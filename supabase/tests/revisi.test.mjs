/**
 * RPC perbaikan laporan — satu-satunya jalan mengubah angka GMV.
 * Yang diuji: alasan wajib, jejak otomatis, dan batas kewenangan.
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
const { uji, jalankan } = buatSuite("Revisi laporan (RPC)");

const TGL = "2024-10-24";
const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;

const U = {
  manager: await idUser("Farhan Pratama"),
  rian: await idUser("Rian Hidayat"),
  anisa: await idUser("Anisa Larasati"),
  leaderMcn: await idUser("Galih Prakoso"),
};

const laporanRian = (
  await sebagaiAdmin(
    db,
    `select r.id from daily_reports r
     join accounts a on a.id = r.account_id
     where a.username = '@skincare_official' and r.tanggal = $1`,
    [TGL],
  )
).rows[0].id;

const gmvSekarang = async (id) =>
  Number(
    (await sebagaiAdmin(db, `select gmv from daily_reports where id=$1`, [id]))
      .rows[0].gmv,
  );

uji("alasan kurang dari 10 karakter ditolak", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.rian,
        `select perbaiki_laporan_harian($1, 5000000, 'salah')`,
        [laporanRian],
      ),
    "alasan pendek seharusnya ditolak",
  );
});

uji("GMV negatif ditolak", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.rian,
        `select perbaiki_laporan_harian($1, -5, 'Alasan yang cukup panjang.')`,
        [laporanRian],
      ),
    "GMV negatif seharusnya ditolak",
  );
});

uji("pemilik laporan bisa memperbaiki dan jejaknya tercatat", async () => {
  const sebelum = await gmvSekarang(laporanRian);
  await sebagai(
    db,
    U.rian,
    `select perbaiki_laporan_harian($1, 5300000,
       'Tiga pesanan masuk setelah cutoff, belum terhitung saat input pertama.')`,
    [laporanRian],
  );

  harusSama(await gmvSekarang(laporanRian), 5300000, "angka baru tersimpan");

  const { rows } = await sebagaiAdmin(
    db,
    `select gmv_lama, gmv_baru, alasan, diubah_oleh
     from daily_report_revisions where report_id=$1 order by created_at desc`,
    [laporanRian],
  );
  harusSama(rows.length, 1);
  harusSama(Number(rows[0].gmv_lama), sebelum);
  harusSama(Number(rows[0].gmv_baru), 5300000);
  harus(rows[0].alasan.includes("cutoff"), "alasan tersimpan apa adanya");
  harusSama(rows[0].diubah_oleh, U.rian, "pengubah tercatat");
});

uji("status laporan berubah jadi 'revisi'", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select status from daily_reports where id=$1`,
    [laporanRian],
  );
  harusSama(rows[0].status, "revisi");
});

uji("orang lain tidak bisa memperbaiki laporan bukan miliknya", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.anisa,
        `select perbaiki_laporan_harian($1, 9000000,
           'Mencoba mengubah laporan milik orang lain.')`,
        [laporanRian],
      ),
    "RLS seharusnya menutup laporan milik orang lain",
  );
});

uji("Leader unit lain juga tidak bisa", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.leaderMcn,
        `select perbaiki_laporan_harian($1, 9000000,
           'Leader MCN mencoba mengubah laporan akun Affiliator.')`,
        [laporanRian],
      ),
    "Leader MCN tidak berhak atas laporan akun Affiliator",
  );
});

uji("Manager boleh memperbaiki dan jejaknya tetap tercatat", async () => {
  await sebagai(
    db,
    U.manager,
    `select perbaiki_laporan_harian($1, 5250000,
       'Koreksi akhir setelah rekonsiliasi dengan Partner Center.')`,
    [laporanRian],
  );
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from daily_report_revisions where report_id=$1`,
    [laporanRian],
  );
  harusSama(Number(rows[0].n), 2, "jejak bertambah, bukan tertimpa");
});

uji("perbaikan tanpa perubahan angka tidak membuat jejak baru", async () => {
  await sebagai(
    db,
    U.rian,
    `select perbaiki_laporan_harian($1, 5250000,
       'Menyimpan ulang tanpa mengubah angka.')`,
    [laporanRian],
  );
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from daily_report_revisions where report_id=$1`,
    [laporanRian],
  );
  harusSama(Number(rows[0].n), 2, "jejak tidak boleh bertambah");
});

uji("catatan ikut diperbarui bila diisi", async () => {
  await sebagai(
    db,
    U.rian,
    `select perbaiki_laporan_harian($1, 5260000,
       'Penyesuaian kecil setelah cek ulang.', 'Catatan diperbarui.')`,
    [laporanRian],
  );
  const { rows } = await sebagaiAdmin(
    db,
    `select catatan from daily_reports where id=$1`,
    [laporanRian],
  );
  harusSama(rows[0].catatan, "Catatan diperbarui.");
});

// ---------------------------------------------------------------------
// Laporan yang dikirim orang lain (0216): yang berhak mengirim laporan
// untuk sasaran itu berhak memperbaikinya.
// ---------------------------------------------------------------------
const TGL_KIRIMAN = "2024-09-30";
const ALASAN = "Angka kiriman Manager berbeda dengan Partner Center.";

const idAkun = async (username) =>
  (
    await sebagaiAdmin(db, `select id from accounts where username=$1`, [
      username,
    ])
  ).rows[0].id;

const kirimanManager = async (username) =>
  (
    await sebagai(
      db,
      U.manager,
      `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
       values ($1, $2, $3, 2000000, 50000) returning id`,
      [U.manager, TGL_KIRIMAN, await idAkun(username)],
    )
  ).rows[0].id;

const jumlahJejak = async (id) =>
  Number(
    (
      await sebagaiAdmin(
        db,
        `select count(*)::int n from daily_report_revisions where report_id=$1`,
        [id],
      )
    ).rows[0].n,
  );

const bolehMenurutRiwayat = async (userId, id) =>
  (
    await sebagai(
      db,
      userId,
      `select boleh_perbaiki from riwayat_laporan_minimum where id=$1`,
      [id],
    )
  ).rows[0]?.boleh_perbaiki;

const K = {
  dewi: await idUser("Dewi Lestari"),
  galih: U.leaderMcn,
  maya: await idUser("Maya Safitri"),
  dimas: await idUser("Dimas Maulana"),
  nabila: await idUser("Nabila Putri"),
  finance: (
    await sebagaiAdmin(db, `select id from users where role='Finance' limit 1`)
  ).rows[0].id,
};
const kirimanSkincare = await kirimanManager("@skincare_official");

uji("PIC memperbaiki laporan akunnya yang dikirim Manager", async () => {
  await sebagai(db, U.rian, `select perbaiki_laporan_harian($1, 2100000, $2)`, [
    kirimanSkincare,
    ALASAN,
  ]);
  harusSama(await gmvSekarang(kirimanSkincare), 2100000);

  const { rows } = await sebagaiAdmin(
    db,
    `select r.user_id, r.status, v.diubah_oleh, v.alasan
     from daily_reports r
     join daily_report_revisions v on v.report_id = r.id
     where r.id = $1`,
    [kirimanSkincare],
  );
  harusSama(rows.length, 1, "jejak tercatat");
  harusSama(rows[0].diubah_oleh, U.rian, "pengubahnya PIC");
  harusSama(rows[0].alasan, ALASAN);
  harusSama(rows[0].status, "revisi");
  harusSama(rows[0].user_id, U.manager, "pengirimnya tetap Manager");
});

uji("komisi kosong tidak menimpa komisi yang diketik Manager", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select komisi from daily_reports where id=$1`,
    [kirimanSkincare],
  );
  harusSama(Number(rows[0].komisi), 50000);
});

uji("PIC dan Co-Leader akun membaca jejak laporan itu", async () => {
  for (const orang of [U.rian, K.dewi]) {
    const { rows } = await sebagai(
      db,
      orang,
      `select count(*)::int n from daily_report_revisions where report_id=$1`,
      [kirimanSkincare],
    );
    harusSama(Number(rows[0].n), 1);
  }
});

uji("Co-Leader akun juga boleh memperbaiki", async () => {
  await sebagai(db, K.dewi, `select perbaiki_laporan_harian($1, 2200000, $2)`, [
    kirimanSkincare,
    ALASAN,
  ]);
  harusSama(await gmvSekarang(kirimanSkincare), 2200000);
  harusSama(await jumlahJejak(kirimanSkincare), 2);
});

uji("hak PIC hanya lewat fungsi, bukan ubah langsung ke tabel", async () => {
  const { rows } = await sebagai(
    db,
    U.rian,
    `update daily_reports set gmv = 1, tanggal = '2024-09-01'
     where id=$1 returning id`,
    [kirimanSkincare],
  );
  harusSama(rows.length, 0, "barisnya tidak boleh tersentuh");
  harusSama(await gmvSekarang(kirimanSkincare), 2200000);
});

uji("yang tidak memegang sasarannya tetap ditolak", async () => {
  for (const orang of [U.anisa, U.leaderMcn, K.finance]) {
    await harusDitolak(
      () =>
        sebagai(db, orang, `select perbaiki_laporan_harian($1, 9000000, $2)`, [
          kirimanSkincare,
          ALASAN,
        ]),
      "bukan pengirim, bukan pemegang akun",
    );
  }
  harusSama(await gmvSekarang(kirimanSkincare), 2200000);
  harusSama(await jumlahJejak(kirimanSkincare), 2);
});

uji("Leader seunit yang tidak tercatat di akun tetap ditolak", async () => {
  const fashion = await idAkun("@fashion_hijab");
  const laporan = await kirimanManager("@fashion_hijab");
  await sebagaiAdmin(db, `update accounts set co_leader_id=null where id=$1`, [
    fashion,
  ]);
  try {
    await harusDitolak(
      () =>
        sebagai(db, K.dewi, `select perbaiki_laporan_harian($1, 9000000, $2)`, [
          laporan,
          ALASAN,
        ]),
      "Leader bukan PIC maupun Co-Leader akun ini",
    );
    harusSama(
      await bolehMenurutRiwayat(K.dewi, laporan),
      false,
      "melihat lewat hierarki bukan berarti boleh memperbaiki",
    );
  } finally {
    await sebagaiAdmin(db, `update accounts set co_leader_id=$1 where id=$2`, [
      K.dewi,
      fashion,
    ]);
  }
});

uji("Leader dan Co-Leader unit memperbaiki laporan unitnya", async () => {
  const mcn = (await sebagaiAdmin(db, `select id from units where kode='mcn'`))
    .rows[0].id;
  const laporan = (
    await sebagai(
      db,
      U.manager,
      `insert into daily_reports (user_id, tanggal, unit_id, gmv)
       values ($1, $2, $3, 3000000) returning id`,
      [U.manager, TGL_KIRIMAN, mcn],
    )
  ).rows[0].id;

  await sebagai(
    db,
    K.galih,
    `select perbaiki_laporan_harian($1, 3100000, $2)`,
    [laporan, ALASAN],
  );
  await sebagai(db, K.maya, `select perbaiki_laporan_harian($1, 3200000, $2)`, [
    laporan,
    ALASAN,
  ]);
  harusSama(await gmvSekarang(laporan), 3200000);

  await harusDitolak(
    () =>
      sebagai(db, K.dimas, `select perbaiki_laporan_harian($1, 9000000, $2)`, [
        laporan,
        ALASAN,
      ]),
    "Leader unit lain tidak berhak",
  );
});

uji("riwayat memberi tahu siapa yang boleh memperbaiki", async () => {
  for (const orang of [U.manager, U.rian, K.dewi]) {
    harusSama(await bolehMenurutRiwayat(orang, kirimanSkincare), true);
  }
  harusSama(await bolehMenurutRiwayat(K.finance, kirimanSkincare), false);
});

uji("profil nonaktif ditolak walau ia pengirimnya", async () => {
  const laporanNabila = (
    await sebagaiAdmin(
      db,
      `select id from daily_reports where user_id=$1 limit 1`,
      [K.nabila],
    )
  ).rows[0].id;
  await sebagaiAdmin(db, `update users set status='nonaktif' where id=$1`, [
    K.nabila,
  ]);
  await harusDitolak(
    () =>
      sebagai(db, K.nabila, `select perbaiki_laporan_harian($1, 9000000, $2)`, [
        laporanNabila,
        ALASAN,
      ]),
    "fungsi ini melewati RLS, jadi gerbang anggota aktif harus diperiksa sendiri",
  );
});

uji("pengunjung tanpa sesi tidak bisa memanggilnya", async () => {
  await db.exec("reset role;");
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec("set role anon;");
  let ditolak = false;
  try {
    await db.query(`select perbaiki_laporan_harian($1, 9000000, $2)`, [
      kirimanSkincare,
      ALASAN,
    ]);
  } catch {
    ditolak = true;
  } finally {
    await db.exec("reset role;");
  }
  harus(ditolak, "tanpa sesi berarti jalur sistem, jadi anon harus tertutup");
  harusSama(await gmvSekarang(kirimanSkincare), 2200000);
});

uji(
  "jalur sistem tanpa sesi tetap bisa, seperti skrip migrasi V1",
  async () => {
    await sebagaiAdmin(db, `select perbaiki_laporan_harian($1, 2300000, $2)`, [
      kirimanSkincare,
      ALASAN,
    ]);
    harusSama(await gmvSekarang(kirimanSkincare), 2300000);
  },
);

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
