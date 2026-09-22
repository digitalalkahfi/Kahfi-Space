/** Agregat GMV harian untuk dasbor analitik (0110). */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Agregat GMV harian");

uji("Satu baris per tanggal, bukan per laporan", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select * from gmv_harian('2024-10-01', '2024-10-24')",
  );
  const tanggal = rows.map((r) => r.tanggal.toISOString().slice(0, 10));
  harusSama(new Set(tanggal).size, tanggal.length);
  harus(rows.length > 0, "seharusnya ada hari terlapor");
});

uji("Hari tanpa laporan tidak dibangkitkan sebagai nol", async () => {
  // September tidak punya laporan sama sekali pada data contoh.
  const { rows } = await sebagaiAdmin(
    db,
    "select * from gmv_harian('2024-09-01', '2024-09-30')",
  );
  harusSama(rows.length, 0);
});

uji("Total harian sama dengan jumlah laporannya", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select h.gmv as agregat,
            (select coalesce(sum(gmv), 0) from daily_reports where tanggal = h.tanggal) as mentah,
            h.jumlah_laporan,
            (select count(*) from daily_reports where tanggal = h.tanggal) as n
     from gmv_harian('2024-10-01', '2024-10-24') h`,
  );
  for (const r of rows) {
    harusSama(Number(r.agregat), Number(r.mentah));
    harusSama(Number(r.jumlah_laporan), Number(r.n));
  }
});

uji("Rentang terbalik menghasilkan kosong, bukan galat", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select * from gmv_harian('2024-10-24', '2024-10-01')",
  );
  harusSama(rows.length, 0);
});

uji("Laporan tingkat akun ikut unit akunnya, bukan jadi tanpa unit", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select kode, gmv from gmv_harian_unit('2024-10-01', '2024-10-24')",
  );
  const kode = rows.map((r) => r.kode);
  harus(
    kode.includes("affiliator"),
    "affiliator hanya punya laporan tingkat akun; ia harus tetap muncul",
  );
  harus(!kode.includes(null), "tidak boleh ada baris tanpa unit");
});

uji("Jumlah seluruh unit sama dengan jumlah seluruh laporan", async () => {
  const { rows: perUnit } = await sebagaiAdmin(
    db,
    "select coalesce(sum(gmv), 0) as total from gmv_harian_unit('2024-10-01', '2024-10-24')",
  );
  const { rows: semua } = await sebagaiAdmin(
    db,
    "select coalesce(sum(gmv), 0) as total from daily_reports where tanggal between '2024-10-01' and '2024-10-24'",
  );
  harusSama(Number(perUnit[0].total), Number(semua[0].total));
});

uji("Unit diurutkan dari sumbangan terbesar", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select gmv from gmv_harian_unit('2024-10-01', '2024-10-24')",
  );
  const nilai = rows.map((r) => Number(r.gmv));
  harusSama(
    JSON.stringify(nilai),
    JSON.stringify([...nilai].sort((a, b) => b - a)),
  );
});

uji("Per unit per hari: satu baris per kombinasi, bukan per laporan", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select tanggal, kode from gmv_harian_per_unit('2024-10-01', '2024-10-24')",
  );
  const kunci = rows.map((r) => `${r.tanggal.toISOString().slice(0, 10)}|${r.kode}`);
  harusSama(new Set(kunci).size, kunci.length);
  harus(rows.length > 0, "seharusnya ada baris");
});

uji("Jumlah per unit per hari sama dengan total hari itu", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select h.tanggal, h.gmv as total,
            (select coalesce(sum(u.gmv), 0)
             from gmv_harian_per_unit(h.tanggal, h.tanggal) u) as per_unit
     from gmv_harian('2024-10-01', '2024-10-24') h`,
  );
  for (const r of rows) {
    harusSama(Number(r.per_unit), Number(r.total));
  }
});

uji("Laporan tingkat akun ikut unit akunnya di pecahan harian juga", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select distinct kode from gmv_harian_per_unit('2024-10-01', '2024-10-24')",
  );
  const kode = rows.map((r) => r.kode);
  harus(kode.includes("affiliator"), "affiliator hanya punya laporan akun");
  harus(!kode.includes(null), "tidak boleh ada baris tanpa unit");
});

uji("Kombinasi tanpa laporan tidak dibangkitkan sebagai nol", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from gmv_harian_per_unit('2024-09-01', '2024-09-30')",
  );
  harusSama(rows[0].n, 0);
});

await jalankan();
