/**
 * Menjalankan seluruh pemeriksaan mutu, lalu meringkasnya.
 *
 * Sebelumnya `verify` hanya rangkaian `&&`. Itu benar — kegagalan
 * menghentikan sisanya dan kode keluarnya ikut — tetapi keluarannya
 * ribuan baris dan berakhir tanpa kesimpulan: orang yang menjalankannya
 * harus menggulir ke atas untuk tahu mana yang gagal, dan sering
 * menyimpulkan salah.
 *
 * Yang ditambahkan di sini cuma ringkasannya. Aturannya tetap sama:
 * berhenti pada kegagalan pertama, dan keluar dengan kode bukan nol.
 */
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const LANGKAH = [
  { nama: "lint", perintah: "npm", argumen: ["run", "lint"] },
  { nama: "typecheck", perintah: "npm", argumen: ["run", "typecheck"] },
  { nama: "contoh ekspor", perintah: "npm", argumen: ["run", "ekspor:cek"] },
  { nama: "tes unit", perintah: "npm", argumen: ["run", "test:unit"] },
  { nama: "tes skema", perintah: "npm", argumen: ["run", "db:test"] },
  { nama: "build", perintah: "npm", argumen: ["run", "build"] },
];

const jalankan = (langkah) =>
  new Promise((selesai) => {
    const mulai = performance.now();
    const anak = spawn(langkah.perintah, langkah.argumen, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    anak.on("close", (kode, sinyal) =>
      selesai({
        kode: kode ?? 1,
        sinyal,
        detik: (performance.now() - mulai) / 1000,
      }),
    );
  });

const hasil = [];
let gagal = null;

for (const langkah of LANGKAH) {
  const { kode, sinyal, detik } = await jalankan(langkah);
  hasil.push({ nama: langkah.nama, kode, sinyal, detik });

  if (kode !== 0) {
    gagal = { ...langkah, kode, sinyal };
    // Berhenti di kegagalan pertama, seperti rangkaian `&&` sebelumnya:
    // langkah berikutnya hampir pasti gagal karena sebab yang sama, dan
    // keluarannya hanya menenggelamkan kegagalan yang sebenarnya.
    break;
  }
}

const lebar = Math.max(...hasil.map((h) => h.nama.length));
console.log("\n── Ringkasan verify ──");
for (const h of hasil) {
  const tanda = h.kode === 0 ? "✓" : "✗";
  console.log(
    `${tanda} ${h.nama.padEnd(lebar)}  ${h.detik.toFixed(1)}s${
      h.sinyal ? ` (dihentikan ${h.sinyal})` : ""
    }`,
  );
}

const dilewati = LANGKAH.length - hasil.length;
if (dilewati > 0) {
  console.log(`· ${dilewati} langkah tidak dijalankan karena ada yang gagal`);
}

if (gagal) {
  console.error(
    `\n✗ Gagal pada langkah "${gagal.nama}" (kode ${gagal.kode}). Jalankan ulang: npm run ${gagal.argumen.at(-1)}`,
  );
  process.exit(gagal.kode);
}

console.log("\n✓ Semua pemeriksaan lulus.");
