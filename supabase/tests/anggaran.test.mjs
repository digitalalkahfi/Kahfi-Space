/**
 * Tabel anggaran & alokasi tambahan (migrasi 0148).
 *
 * Yang dijaga di sini bukan bentuk tabelnya, melainkan empat aturan yang
 * membuatnya berguna: satu pos satu pagu, pengajuan selalu beralasan,
 * keputusan tidak bisa diulang, dan pengaju bukan pemutus.
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
const { uji, jalankan } = buatSuite("Anggaran & alokasi");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  farhan: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
  hafidz: (await satu(`select id from users where nama='Hafidz Alkahfi'`)).id,
  galih: (await satu(`select id from users where nama='Galih Prakoso'`)).id,
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
};
const UNIT = {
  mcn: (await satu(`select id from units where kode='mcn'`)).id,
  tap: (await satu(`select id from units where kode='tap'`)).id,
};

const pagu = (userId, periode, unitId, jenis, jumlah) =>
  sebagai(
    db,
    userId,
    `insert into budgets (periode, unit_id, jenis, jumlah, dibuat_oleh)
     values ($1,$2,$3,$4,$5) returning id`,
    [periode, unitId, jenis, jumlah, userId],
  );

const ajukan = (userId, periode, unitId, jumlah, alasan) =>
  sebagai(
    db,
    userId,
    `insert into budget_allocations
       (periode, unit_id, jenis, jumlah, alasan, diajukan_id)
     values ($1,$2,'beban',$3,$4,$5) returning id`,
    [periode, unitId, jumlah, alasan, userId],
  );

uji("satu pos hanya punya satu pagu per periode", async () => {
  await pagu(U.farhan, "2024-10", UNIT.mcn, "beban", 5_000_000);
  await harusDitolak(
    () => pagu(U.farhan, "2024-10", UNIT.mcn, "beban", 9_000_000),
    "pagu kedua untuk pos yang sama harus ditolak",
  );

  // Jenis lain di unit yang sama tetap boleh — yang unik adalah posnya.
  await pagu(U.farhan, "2024-10", UNIT.mcn, "aset", 1_000_000);
});

uji("pagu perusahaan tanpa unit juga hanya satu per pos", async () => {
  // `nulls not distinct`: tanpa itu, unit kosong dianggap selalu
  // berbeda dan pagu perusahaan bisa berlipat tanpa ketahuan.
  await pagu(U.farhan, "2024-10", null, "dividen", 30_000_000);
  await harusDitolak(() => pagu(U.farhan, "2024-10", null, "dividen", 1));
});

uji("pagu nol atau negatif ditolak", async () => {
  await harusDitolak(() => pagu(U.farhan, "2024-11", UNIT.tap, "beban", 0));
  await harusDitolak(() => pagu(U.farhan, "2024-11", UNIT.tap, "beban", -5));
});

uji("periode harus berbentuk YYYY-MM", async () => {
  for (const salah of ["2024-13", "2024-1", "24-10", "2024-10-01"]) {
    await harusDitolak(
      () => pagu(U.farhan, salah, UNIT.tap, "beban", 1_000_000),
      `periode ${salah} harus ditolak`,
    );
  }
});

uji("pengajuan tanpa alasan yang berarti ditolak", async () => {
  await harusDitolak(() => ajukan(U.galih, "2024-10", UNIT.mcn, 1_000_000, ""));
  await harusDitolak(() =>
    ajukan(U.galih, "2024-10", UNIT.mcn, 1_000_000, "perlu"),
  );
});

uji("pengajuan selalu lahir berstatus diajukan", async () => {
  const { rows } = await ajukan(
    U.galih,
    "2024-10",
    UNIT.mcn,
    3_000_000,
    "Tambahan konsumsi rapat mingguan MMC",
  );
  const b = await satu(`select * from budget_allocations where id = $1`, [
    rows[0].id,
  ]);

  harusSama(b.status, "diajukan");
  harusSama(b.diputuskan_id, null);
  harusSama(b.diputuskan_pada, null);
});

uji("penolakan wajib beralasan", async () => {
  const { rows } = await ajukan(
    U.galih,
    "2024-11",
    UNIT.mcn,
    2_000_000,
    "Sewa studio tambahan untuk kampanye November",
  );
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.farhan,
        `update budget_allocations
            set status='ditolak', diputuskan_id=$2, diputuskan_pada=now()
          where id=$1`,
        [rows[0].id, U.farhan],
      ),
    "ditolak tanpa catatan harus gagal",
  );
});

uji("keputusan tidak bisa diulang", async () => {
  const { rows } = await ajukan(
    U.galih,
    "2024-12",
    UNIT.mcn,
    1_500_000,
    "Perpanjangan langganan alat edit video",
  );
  const id = rows[0].id;

  await sebagai(
    db,
    U.farhan,
    `update budget_allocations
        set status='disetujui', diputuskan_id=$2, diputuskan_pada=now()
      where id=$1`,
    [id, U.farhan],
  );

  await harusDitolak(
    () =>
      sebagai(
        db,
        U.farhan,
        `update budget_allocations
            set status='ditolak',
                catatan_keputusan='Ternyata dananya tidak tersedia'
          where id=$1`,
        [id],
      ),
    "yang sudah diputuskan tidak bisa dibalik diam-diam",
  );
});

uji("pengaju tidak boleh memutuskan pengajuannya sendiri", async () => {
  // Farhan boleh memutuskan (Manager), tapi tidak untuk pengajuannya
  // sendiri — aturan yang sama dengan persetujuan transaksi.
  const { rows } = await ajukan(
    U.farhan,
    "2025-01",
    UNIT.tap,
    1_000_000,
    "Uji coba iklan berbayar awal tahun",
  );
  await harusDitolak(() =>
    sebagai(
      db,
      U.farhan,
      `update budget_allocations
          set status='disetujui', diputuskan_id=$2, diputuskan_pada=now()
        where id=$1`,
      [rows[0].id, U.farhan],
    ),
  );

  // Orang lain yang berwenang tetap bisa.
  await sebagai(
    db,
    U.hafidz,
    `update budget_allocations
        set status='disetujui', diputuskan_id=$2, diputuskan_pada=now()
      where id=$1`,
    [rows[0].id, U.hafidz],
  );
  harusSama(
    (
      await satu(`select status from budget_allocations where id=$1`, [
        rows[0].id,
      ])
    ).status,
    "disetujui",
  );
});

uji("Staff tidak melihat maupun mengajukan anggaran", async () => {
  const { rows } = await sebagai(
    db,
    U.rian,
    `select count(*)::int as n from budgets`,
  );
  harusSama(rows[0].n, 0, "pagu adalah angka perusahaan");

  const pengajuan = await sebagai(
    db,
    U.rian,
    `select count(*)::int as n from budget_allocations`,
  );
  harusSama(pengajuan.rows[0].n, 0);

  await harusDitolak(() =>
    ajukan(U.rian, "2025-02", UNIT.mcn, 500_000, "Ingin menambah pagu sendiri"),
  );
});

uji("Leader melihat pengajuan tapi bukan pagunya", async () => {
  // Yang memimpin unit perlu tahu pengajuannya sudah diputuskan atau
  // belum; angka pagu perusahaan tetap bukan urusannya.
  const pengajuan = await sebagai(
    db,
    U.galih,
    `select count(*)::int as n from budget_allocations`,
  );
  harus(pengajuan.rows[0].n > 0, "pengajuannya sendiri harus terlihat");

  const paguTerlihat = await sebagai(
    db,
    U.galih,
    `select count(*)::int as n from budgets`,
  );
  harusSama(paguTerlihat.rows[0].n, 0);
});

uji("membetulkan pagu tidak boleh menabrak pos lain", async () => {
  // Jalur yang dipakai `simpanAnggaran` saat menyunting: mengubah
  // periode/unit/jenis sebuah baris bisa membuatnya bertabrakan dengan
  // pos yang sudah ada, dan itu harus ditolak sekeras menambah baris.
  const { rows } = await pagu(
    U.farhan,
    "2025-03",
    UNIT.tap,
    "beban",
    2_000_000,
  );
  await pagu(U.farhan, "2025-03", UNIT.tap, "aset", 1_000_000);

  await harusDitolak(
    () =>
      sebagai(db, U.farhan, `update budgets set jenis='aset' where id = $1`, [
        rows[0].id,
      ]),
    "menyunting jadi pos yang sudah ada harus ditolak",
  );

  // Membetulkan angkanya sendiri tetap boleh.
  await sebagai(db, U.farhan, `update budgets set jumlah = $2 where id = $1`, [
    rows[0].id,
    7_000_000,
  ]);
  harusSama(
    Number(
      (await satu(`select jumlah from budgets where id = $1`, [rows[0].id]))
        .jumlah,
    ),
    7_000_000,
  );
});

uji("keputusan hanya mengenai pengajuan yang masih menunggu", async () => {
  // `putuskanAlokasi` menyaring `status = 'diajukan'` saat menulis.
  // Kalau dua orang memutuskan hampir bersamaan, yang kedua tidak boleh
  // menimpa keputusan yang pertama.
  const { rows } = await ajukan(
    U.galih,
    "2025-04",
    UNIT.mcn,
    2_500_000,
    "Tambahan biaya produksi konten April",
  );
  const id = rows[0].id;

  await sebagai(
    db,
    U.farhan,
    `update budget_allocations
        set status='disetujui', diputuskan_id=$2, diputuskan_pada=now()
      where id=$1 and status='diajukan'`,
    [id, U.farhan],
  );

  const kedua = await sebagai(
    db,
    U.hafidz,
    `update budget_allocations
        set status='ditolak', diputuskan_id=$2, diputuskan_pada=now(),
            catatan_keputusan='Dananya sudah dialihkan ke pos lain'
      where id=$1 and status='diajukan'
      returning id`,
    [id, U.hafidz],
  );

  harusSama(kedua.rows.length, 0, "tidak ada baris yang tersentuh");
  harusSama(
    (await satu(`select status from budget_allocations where id=$1`, [id]))
      .status,
    "disetujui",
    "keputusan pertama yang berlaku",
  );
});

uji("pagu tersimpan terbaca lagi apa adanya", async () => {
  // Lapisan data membaca `budgets` lewat join unit; yang diperiksa di
  // sini bahwa nilainya bulat kembali, termasuk pagu perusahaan yang
  // unitnya memang kosong.
  await pagu(U.farhan, "2025-05", null, "beban", 12_345_678);
  const b = await satu(
    `select periode, unit_id, jenis, jumlah, catatan
       from budgets where periode='2025-05' and jenis='beban'`,
  );

  harusSama(b.unit_id, null, "pagu perusahaan memang tanpa unit");
  harusSama(Number(b.jumlah), 12_345_678);
  harusSama(b.catatan, "", "catatan kosong tetap teks kosong, bukan null");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
