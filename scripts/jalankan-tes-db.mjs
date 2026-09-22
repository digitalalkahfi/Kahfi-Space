/**
 * Menjalankan seluruh test skema di supabase/tests.
 * Tiap berkas dijalankan sebagai proses sendiri supaya database-nya bersih.
 */
import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const DIR = path.join(process.cwd(), "supabase", "tests");
const berkas = (await readdir(DIR).catch(() => []))
  .filter((f) => f.endsWith(".test.mjs"))
  .sort();

if (berkas.length === 0) {
  console.log("Belum ada test skema.");
  process.exit(0);
}

/**
 * Menjalankan satu berkas test sebagai proses sendiri.
 *
 * `signal` ikut dikembalikan: proses yang dihentikan sistem (mis.
 * kehabisan memori saat beberapa instans PGlite hidup bersamaan) keluar
 * tanpa mencetak apa pun, dan tanpa catatan itu kegagalannya tak bisa
 * ditelusuri.
 */
const jalankanBerkas = (f) =>
  new Promise((selesai) => {
    // Hook alias dipasang untuk semua berkas: sebagian test membandingkan
    // hasil SQL dengan modul aplikasi yang mengimpor lewat "@/".
    const anak = spawn(
      process.execPath,
      [
        "--import",
        path.join(process.cwd(), "scripts", "alias-ts.mjs"),
        path.join(DIR, f),
      ],
      { stdio: "inherit" },
    );
    anak.on("exit", (kode, sinyal) => selesai({ kode, sinyal }));
  });

const gagal = [];
for (const f of berkas) {
  let { kode, sinyal } = await jalankanBerkas(f);

  // Satu kali ulang. PGlite menjalankan PostgreSQL penuh di WASM, dan di
  // mesin yang sedang sibuk prosesnya kadang dimatikan sistem sebelum
  // sempat menjalankan satu test pun. Kegagalan yang benar-benar karena
  // SQL akan gagal lagi di percobaan kedua.
  if (kode !== 0) {
    console.log(`\n↻ ${f} diulang sekali (keluar ${sinyal ?? kode}).\n`);
    ({ kode, sinyal } = await jalankanBerkas(f));
  }

  if (kode !== 0) gagal.push(sinyal ? `${f} (dihentikan ${sinyal})` : f);
}

console.log(
  gagal.length === 0
    ? `\n✓ Semua berkas test skema lulus (${berkas.length}).`
    : `\n✗ ${gagal.length} dari ${berkas.length} berkas test gagal:\n  ${gagal.join("\n  ")}`,
);
process.exit(gagal.length > 0 ? 1 : 0);
