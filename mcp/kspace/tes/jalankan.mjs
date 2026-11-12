/**
 * Menjalankan semua tes MCP kspace (`npm test` di folder mcp/kspace).
 *
 * Tiap berkas jadi proses sendiri supaya database PGlite-nya bersih.
 * Dijalankan dari AKAR REPO karena harness skema membaca
 * `supabase/migrations` relatif terhadap folder kerja. Tidak menyentuh
 * database produksi sama sekali.
 */
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const AKAR = path.resolve(DIR, "..", "..", "..");
const berkas = (await readdir(DIR)).filter((f) => f.endsWith(".test.mjs")).sort();

const jalankan = (f) =>
  new Promise((selesai) => {
    const anak = spawn(process.execPath, [path.join(DIR, f)], { cwd: AKAR, stdio: "inherit" });
    anak.on("exit", (kode, sinyal) => selesai({ kode, sinyal }));
  });

const gagal = [];
for (const f of berkas) {
  let { kode, sinyal } = await jalankan(f);
  // Sama seperti runner skema: PGlite kadang dimatikan sistem saat mesin
  // sibuk. Kegagalan sungguhan akan gagal lagi di percobaan kedua.
  if (kode !== 0) {
    console.log(`\n↻ ${f} diulang sekali (keluar ${sinyal ?? kode}).\n`);
    ({ kode, sinyal } = await jalankan(f));
  }
  if (kode !== 0) gagal.push(f);
}

if (gagal.length > 0) {
  console.error(`\n✗ Tes MCP gagal: ${gagal.join(", ")}`);
  process.exit(1);
}
console.log(`\n✓ Semua tes MCP kspace lulus (${berkas.length} berkas).`);
