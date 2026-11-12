/**
 * Memeriksa sambungan MCP kspace ke database, tanpa menampilkan data.
 *   npm run cek
 *
 * Hanya membaca. Yang dicetak: siapa peran yang masuk, apakah sesi
 * hanya-baca, batas waktu, zona waktu, dan jumlah baris tiap tool.
 */
import { buatDbPg } from "../lib/db-pg.mjs";
import { galatAman } from "../lib/galat.mjs";
import { panggilTool } from "../lib/server.mjs";
import { DAFTAR_TOOL } from "../lib/tools.mjs";

const db = buatDbPg();
let gagal = false;

try {
  const [s] = await db.baca((q) =>
    q(`select session_user::text as peran,
              current_setting('transaction_read_only') as hanya_baca,
              current_setting('statement_timeout') as batas_waktu,
              current_setting('timezone') as zona`),
  );
  console.log(`Masuk sebagai      : ${s.peran}`);
  console.log(`Transaksi hanya-baca: ${s.hanya_baca}`);
  console.log(`Batas waktu query  : ${s.batas_waktu}`);
  console.log(`Zona waktu         : ${s.zona}`);
  if (!s.peran.startsWith("asisten_baca") || s.hanya_baca !== "on") {
    gagal = true;
    console.log("✗ Sesi TIDAK sesuai harapan (harus asisten_baca dan hanya-baca).");
  }
} catch (e) {
  gagal = true;
  console.log(`✗ Tidak bisa tersambung — ${galatAman(e).pesan}`);
}

if (!gagal) {
  for (const tool of DAFTAR_TOOL) {
    const argumen =
      tool.nama === "gmv_harian"
        ? await db
            .baca((q) => q(`select (asisten.hari_ini() - 7)::text as dari, asisten.hari_ini()::text as sampai`))
            .then(([b]) => b)
        : {};
    const h = await panggilTool(tool, db, argumen);
    if (!h.sukses) gagal = true;
    console.log(`${h.sukses ? "✓" : "✗"} ${tool.nama.padEnd(17)} ${h.sukses ? `${h.baris} baris` : h.teks}`);
  }
}
console.log(gagal ? "\n✗ Ada yang gagal." : "\n✓ Sambungan dan keenam tool bekerja.");
process.exit(gagal ? 1 : 0);
