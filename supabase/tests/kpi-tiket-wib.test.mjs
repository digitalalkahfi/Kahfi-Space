/**
 * KPI tiket dipetakan ke periode menurut tanggal WIB (migrasi 0185).
 *
 * Tiket bertenggat 00.00–06.59 WIB jatuh di tanggal UTC sebelumnya;
 * sebelum 0185, tenggat 1 Oktober 05.00 WIB terhitung di KPI September.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buatDb,
  buatSuite,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
// Supabase menjalankan sesi basis data dalam UTC, sedangkan PGlite
// mengikuti zona mesin yang menjalankan tes (WIB di laptop tim). Tanpa
// ini `tenggat::date` kebetulan sudah tanggal WIB dan bug-nya tak terlihat.
await sebagaiAdmin(db, `set timezone to 'UTC'`);
const { uji, jalankan } = buatSuite("KPI tiket per tanggal WIB (0185)");

const MIGRASI = await readFile(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "0185_kpi_tiket_tanggal_wib.sql",
  ),
  "utf8",
);

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu(`select id from users where nama = $1`, [nama])).id;

const DEWI = await id("Dewi Lestari"); // Leader, atasan Rian
const RIAN = await id("Rian Hidayat");

/** Realisasi KPI tiket Rian untuk satu bulan penuh, dibulatkan. */
const realisasi = async (bulan, siapa = null) => {
  const sql = `select round(realisasi_kpi($1, 'tiket', $2::date,
                 ($2::date + interval '1 month - 1 day')::date), 1)::text as n`;
  const { rows } = siapa
    ? await sebagai(db, siapa, sql, [RIAN, bulan])
    : await sebagaiAdmin(db, sql, [RIAN, bulan]);
  return rows[0].n;
};

// Data contoh bertanggal 2024; periode 2026 hanya berisi tiket di bawah ini.
await sebagaiAdmin(
  db,
  `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat,
                      kriteria_selesai, status, created_at)
   values
     -- 1 Okt 05.00 WIB = 30 Sep 22.00 UTC; sudah selesai.
     ('tiket', 'Tiket dini hari', $1, $2, '2026-10-01T05:00:00+07:00',
      'Laporan terkirim', 'selesai', '2026-09-25T10:00:00+07:00'),
     -- 30 Sep 20.00 WIB = 30 Sep 13.00 UTC; belum dikerjakan.
     ('tiket', 'Tiket malam', $1, $2, '2026-09-30T20:00:00+07:00',
      'Laporan terkirim', 'todo', '2026-09-25T10:00:00+07:00'),
     -- Tiket lama tanpa tenggat, dibuat 1 Nov 01.00 WIB = 31 Okt 18.00 UTC.
     ('tiket', 'Tiket lama tanpa tenggat', $1, $2, null,
      '', 'selesai', '2026-11-01T01:00:00+07:00')`,
  [DEWI, RIAN],
);

uji("tenggat 1 Okt 05.00 WIB masuk KPI Oktober, bukan September", async () => {
  harusSama(
    await realisasi("2026-10-01"),
    "100.0",
    "Oktober: 1 dari 1 selesai",
  );
  harusSama(
    await realisasi("2026-09-01"),
    "0.0",
    "September: 0 dari 1 selesai",
  );
});

uji("tiket tanpa tenggat dipetakan menurut tanggal dibuat di WIB", async () => {
  harusSama(await realisasi("2026-11-01"), "100.0", "November: 1 dari 1");
});

uji("atasan melihat angka yang sama dengan proses sistem", async () => {
  harusSama(await realisasi("2026-10-01", DEWI), "100.0");
  harusSama(await realisasi("2026-09-01", DEWI), "0.0");
});

uji("sumber lain tidak ikut berubah", async () => {
  // Absensi Rian di 2024 tetap dihitung seperti sebelumnya: cukup
  // dipastikan fungsinya tetap memberi angka atau null tanpa galat.
  const { n } = await satu(
    `select realisasi_kpi($1, 'absensi', '2024-10-01', '2024-10-31')::text as n`,
    [RIAN],
  );
  harusSama(typeof n === "string" || n === null, true);
});

uji("sesi tes berjalan dalam UTC, seperti Supabase", async () => {
  const { d } = await satu(
    `select (timestamptz '2026-10-01T05:00:00+07:00')::date::text as d`,
  );
  harusSama(d, "2026-09-30", "tanggal UTC dari tenggat 1 Okt 05.00 WIB");
});

uji("migrasi aman dijalankan ulang", async () => {
  await sebagaiAdmin(db, MIGRASI);
  await sebagaiAdmin(db, MIGRASI);
  harusSama(await realisasi("2026-10-01"), "100.0");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
