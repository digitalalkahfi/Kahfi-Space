/** Transaksi keuangan: bentuk data, status yang dipaksa, dan cakupan RLS. */
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
const { uji, jalankan } = buatSuite("Transaksi keuangan");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const unitId = async (kode) =>
  (await sebagaiAdmin(db, "select id from units where kode = $1", [kode]))
    .rows[0].id;

const finance = await id("Laras Ayuningtyas");
const manager = await id("Farhan Pratama");
const ceo = await id("Hafidz Alkahfi");
const staf = await id("Rian Hidayat");
const leader = await id("Dewi Lestari");
const mcn = await unitId("mcn");

/** Mengajukan satu pengeluaran atas nama seseorang. */
const ajukan = async (oleh, isi = {}) => {
  const { rows } = await sebagai(
    db,
    oleh,
    `insert into transactions
       (tanggal, arah, jenis, unit_id, keterangan, jumlah, diajukan_id)
     values ($1, 'keluar', $2, $3, $4, $5, $6)
     returning id, status, diajukan_id, disetujui_id, diputuskan_pada`,
    [
      isi.tanggal ?? "2024-10-24",
      isi.jenis ?? "beban",
      isi.unit_id ?? null,
      isi.keterangan ?? "Percobaan pengeluaran",
      isi.jumlah ?? 1_000_000,
      oleh,
    ],
  );
  return rows[0];
};

/** Mencatat keputusan lewat jalur yang sama dengan aplikasinya (0098). */
const putuskan = (oleh, transaksiId, ke, catatan = "") =>
  sebagai(
    db,
    oleh,
    `insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
     values ($1, $2, $3, $4)`,
    [transaksiId, ke, oleh, catatan],
  );

const status = async (transaksiId) =>
  (await sebagaiAdmin(db, "select * from transactions where id = $1", [
    transaksiId,
  ])).rows[0];

uji("seed memuat transaksi beserta keputusannya", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select status, count(*)::int as n from transactions group by status order by status",
  );
  const peta = Object.fromEntries(rows.map((r) => [r.status, r.n]));

  harusSama(peta.diajukan, 2, "pengajuan yang masih menunggu");
  harusSama(peta.disetujui, 1, "sudah disetujui, belum dibayar");
  harusSama(peta.ditolak, 1, "ditolak");
  harus(peta.dibayar >= 13, "sebagian besar transaksi contoh sudah dibayar");
});

uji("pengeluaran selalu mulai dari diajukan, walau pengirim memaksa", async () => {
  const { rows } = await sebagai(
    db,
    finance,
    `insert into transactions
       (tanggal, arah, jenis, keterangan, jumlah, status, diajukan_id, disetujui_id)
     values ('2024-10-24', 'keluar', 'beban', 'Pengeluaran maksa', 500000,
             'dibayar', $1, $1)
     returning status, disetujui_id, diputuskan_pada`,
    [finance],
  );

  harusSama(rows[0].status, "diajukan", "status dipaksa kembali ke awal");
  harusSama(rows[0].disetujui_id, null, "belum ada yang memutuskan");
  harusSama(rows[0].diputuskan_pada, null, "belum ada waktu keputusan");
});

uji("pemasukan tercatat langsung sebagai dibayar", async () => {
  const { rows } = await sebagai(
    db,
    finance,
    `insert into transactions
       (tanggal, arah, unit_id, keterangan, jumlah, diajukan_id)
     values ('2024-10-24', 'masuk', $1, 'Pencairan percobaan', 2000000, $2)
     returning status, disetujui_id`,
    [mcn, finance],
  );

  harusSama(rows[0].status, "dibayar", "uang masuk tidak perlu disetujui");
  harusSama(rows[0].disetujui_id, finance, "pencatatnya sekaligus pemutusnya");
});

uji("pengeluaran tanpa jenis ditolak basis data", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        finance,
        `insert into transactions (tanggal, arah, keterangan, jumlah, diajukan_id)
         values ('2024-10-24', 'keluar', 'Tanpa jenis sama sekali', 100000, $1)`,
        [finance],
      ),
    "pengeluaran wajib berjenis (PRD §4)",
  );
});

uji("pemasukan tanpa unit ditolak: kontribusi unit jadi tak terhitung", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        finance,
        `insert into transactions (tanggal, arah, keterangan, jumlah, diajukan_id)
         values ('2024-10-24', 'masuk', 'Pemasukan tanpa unit', 100000, $1)`,
        [finance],
      ),
    "pemasukan wajib menyebut unitnya",
  );
});

uji("pemasukan tidak boleh memakai jenis pengeluaran", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        finance,
        `insert into transactions (tanggal, arah, jenis, unit_id, keterangan, jumlah, diajukan_id)
         values ('2024-10-24', 'masuk', 'beban', $1, 'Masuk berjenis', 100000, $2)`,
        [mcn, finance],
      ),
    "jenis hanya milik pengeluaran",
  );
});

uji("direct cost wajib menempel pada unit", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        finance,
        `insert into transactions (tanggal, arah, jenis, keterangan, jumlah, diajukan_id)
         values ('2024-10-24', 'keluar', 'direct_cost', 'Iklan tanpa unit', 100000, $1)`,
        [finance],
      ),
    "direct cost melekat pada pendapatan sebuah unit",
  );
});

uji("nominal nol atau minus ditolak", async () => {
  await harusDitolak(
    () => ajukan(finance, { jumlah: 0 }),
    "nominal harus lebih dari nol",
  );
});

uji("keterangan terlalu pendek ditolak", async () => {
  await harusDitolak(
    () => ajukan(finance, { keterangan: "abc" }),
    "keterangan minimal lima huruf",
  );
});

uji("status hanya berpindah lewat langkah yang masuk akal", async () => {
  const t = await ajukan(finance, { keterangan: "Uji perpindahan status" });

  // diajukan → dibayar melompati persetujuan.
  await harusDitolak(
    () => putuskan(manager, t.id, "dibayar"),
    "pembayaran tanpa persetujuan",
  );

  await putuskan(manager, t.id, "disetujui");
  harusSama((await status(t.id)).status, "disetujui", "disetujui Manager");

  // disetujui → ditolak: keputusan yang berubah perlu jejaknya sendiri.
  await harusDitolak(
    () => putuskan(manager, t.id, "ditolak", "Berubah pikiran setelah rapat"),
    "menolak sesudah menyetujui",
  );

  await putuskan(finance, t.id, "dibayar");
  const akhir = await status(t.id);
  harusSama(akhir.status, "dibayar", "dibayar Finance");
  harusSama(akhir.disetujui_id, manager, "penyetujunya tidak tertimpa pembayar");
  harus(akhir.diputuskan_pada !== null, "waktu keputusan ikut tercatat");
});

uji("nominal tidak bisa diubah setelah diputuskan", async () => {
  const t = await ajukan(finance, { keterangan: "Uji ubah nominal" });

  // Selama masih diajukan, pengaju boleh membetulkan isinya.
  await sebagai(db, finance, "update transactions set jumlah = 2000000 where id = $1", [t.id]);
  harusSama(Number((await status(t.id)).jumlah), 2_000_000, "boleh dibetulkan");

  await putuskan(manager, t.id, "disetujui");

  // RLS menolak dengan nol baris, bukan dengan galat: yang diperiksa
  // karena itu keadaan datanya, bukan lemparan errornya.
  await sebagai(db, finance, "update transactions set jumlah = 9000000 where id = $1", [
    t.id,
  ]);
  harusSama(
    Number((await status(t.id)).jumlah),
    2_000_000,
    "nominal tidak berubah sesudah disetujui",
  );
});

uji("saldo kas hanya menghitung yang sudah dibayar", async () => {
  // Ditanyakan sebagai Finance: `saldo_kas()` memang hanya menjawab
  // pemegang angka perusahaan (migrasi 0101).
  const kas = async () =>
    Number((await sebagai(db, finance, "select saldo_kas() as s")).rows[0].s);

  const awal = await kas();

  const t = await ajukan(finance, {
    keterangan: "Belum menggerakkan kas",
    jumlah: 7_000_000,
  });
  await putuskan(manager, t.id, "disetujui");

  harusSama(await kas(), awal, "pengajuan yang disetujui belum memindahkan kas");

  await putuskan(finance, t.id, "dibayar");
  harusSama(await kas(), awal - 7_000_000, "baru setelah dibayar kas berkurang");
});

uji("Staff dan Leader tidak melihat satu pun transaksi", async () => {
  for (const [nama, orang] of [
    ["Staff", staf],
    ["Leader", leader],
  ]) {
    const { rows } = await sebagai(db, orang, "select id from transactions");
    harusSama(rows.length, 0, `${nama} tidak melihat angka perusahaan`);
  }
});

uji("Finance, Manager, dan CEO melihat seluruh transaksi", async () => {
  const semua = Number(
    (await sebagaiAdmin(db, "select count(*)::int as n from transactions")).rows[0]
      .n,
  );

  for (const [nama, orang] of [
    ["Finance", finance],
    ["Manager", manager],
    ["CEO", ceo],
  ]) {
    const { rows } = await sebagai(db, orang, "select count(*)::int as n from transactions");
    harusSama(rows[0].n, semua, `${nama} melihat semuanya`);
  }
});

uji("Staff tidak bisa mencatat transaksi", async () => {
  await harusDitolak(
    () => ajukan(staf, { keterangan: "Pengeluaran dari staf" }),
    "Staff bukan pemegang angka perusahaan",
  );
});

uji("transaksi tidak bisa dicatat atas nama orang lain", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        finance,
        `insert into transactions (tanggal, arah, jenis, keterangan, jumlah, diajukan_id)
         values ('2024-10-24', 'keluar', 'beban', 'Mengatasnamakan Manager', 100000, $1)`,
        [manager],
      ),
    "pengaju harus dirinya sendiri",
  );
});

uji("kas awal hanya terbaca pemegang angka perusahaan", async () => {
  const { rows: terlihat } = await sebagai(
    db,
    finance,
    "select kas_awal from keuangan_pengaturan",
  );
  harusSama(terlihat.length, 1, "Finance membacanya");

  const { rows: tersembunyi } = await sebagai(
    db,
    staf,
    "select kas_awal from keuangan_pengaturan",
  );
  harusSama(tersembunyi.length, 0, "Staff tidak");
});

await jalankan();
await db.close();
