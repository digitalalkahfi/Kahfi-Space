import { strict as assert } from "node:assert";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * Setiap pintu ke data sistem lama harus dijaga peran yang sama.
 *
 * Isinya data pribadi seluruh karyawan lama — nama, surel, nomor
 * telepon, kehadiran, penghasilan. Satu halaman atau satu jalur API yang
 * ditambahkan tanpa penjagaan tidak menimbulkan galat apa pun; ia hanya
 * terbuka. Berkas ini yang menahannya.
 */
function berkasDi(akar: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(akar)) {
    const jalur = path.join(akar, nama);
    if (statSync(jalur).isDirectory()) {
      hasil.push(...berkasDi(jalur));
      continue;
    }
    if (nama === "page.tsx" || nama === "route.ts") hasil.push(jalur);
  }
  return hasil;
}

const halaman = berkasDi("src/app/migrasi");
const jalurApi = berkasDi("src/app/api/migrasi");

test("ada halaman dan jalur API migrasi yang diperiksa", () => {
  // Kalau daftarnya kosong, pengujian di bawah lolos tanpa menguji apa pun.
  assert.ok(halaman.length >= 4, `halaman migrasi terbaca: ${halaman.length}`);
  assert.ok(jalurApi.length >= 3, `jalur API terbaca: ${jalurApi.length}`);
});

test("setiap halaman migrasi memeriksa peran sebelum menampilkan apa pun", () => {
  for (const berkas of halaman) {
    const isi = readFileSync(berkas, "utf8");
    assert.match(isi, /bolehMigrasi/, `${berkas} tidak memanggil bolehMigrasi`);
    assert.match(
      isi,
      /sesiSaatIni/,
      `${berkas} tidak memeriksa sesi sama sekali`,
    );
    assert.match(
      isi,
      /AksesDitolak|redirect/,
      `${berkas} tidak menolak yang tidak berhak`,
    );
  }
});

test("setiap jalur API migrasi menolak yang bukan Owner/Manager", () => {
  for (const berkas of jalurApi) {
    const isi = readFileSync(berkas, "utf8");
    assert.match(isi, /bolehMigrasi/, `${berkas} tidak memanggil bolehMigrasi`);
    assert.match(isi, /403/, `${berkas} tidak pernah menjawab 403`);
  }
});

test("jalur API migrasi tidak menyimpan jawabannya di singgahan", () => {
  // Jawabannya berisi data pribadi dan berubah tiap saat; tersimpan di
  // singgahan berarti orang berikutnya bisa membaca jawaban orang
  // sebelumnya.
  for (const berkas of jalurApi) {
    const isi = readFileSync(berkas, "utf8");
    assert.match(isi, /no-store/, `${berkas} tidak menolak penyinggahan`);
  }
});

test("setiap Server Action migrasi memeriksa peran sebelum menulis", () => {
  // Server Action adalah pintu yang paling mudah terlupa: ia tidak punya
  // URL, tidak muncul di daftar route, dan tetap bisa dipanggil siapa pun
  // yang punya akun.
  const isi = readFileSync("src/app/actions/migrasi.ts", "utf8");

  // Tiap fungsi diperiksa terpisah supaya satu penjagaan di fungsi lain
  // tidak menutupi fungsi yang lupa dijaga.
  const bagian = isi.split(/\nexport async function /).slice(1);
  assert.ok(bagian.length >= 6, `server action terbaca: ${bagian.length}`);

  for (const potong of bagian) {
    const nama = potong.slice(0, potong.indexOf("("));
    assert.match(
      potong,
      /sesiSaatIni\(\)/,
      `${nama} tidak memeriksa sesi sama sekali`,
    );
    assert.match(
      potong,
      /bolehMigrasi/,
      `${nama} tidak memanggil bolehMigrasi`,
    );
  }
});

test("tidak ada Server Action migrasi yang melewati mode demo", () => {
  // Mode demo tidak terhubung sistem lama; menulis dari sana berarti
  // menulis ke tempat yang tidak dimaksudkan siapa pun.
  const isi = readFileSync("src/app/actions/migrasi.ts", "utf8");
  const bagian = isi.split(/\nexport async function /).slice(1);

  for (const potong of bagian) {
    const nama = potong.slice(0, potong.indexOf("("));
    assert.match(
      potong,
      /modeData\(\) === "demo"/,
      `${nama} tidak menangani mode demo`,
    );
  }
});
