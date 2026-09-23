import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { KUNCI_DIKENAL, bacaEksporV1, golonganKunci } from "@/lib/ekspor-v1";

/**
 * Contoh ekspor di repositori harus tetap terbaca dan tetap bersih.
 *
 * Berkas ini ikut dibundel aplikasi dan dipakai mode demo. Kalau
 * bentuknya melenceng dari yang dibaca `bacaEksporV1`, yang rusak bukan
 * contohnya saja — layar demo ikut kosong tanpa ada yang tahu sebabnya.
 */
const berkas = JSON.parse(
  readFileSync("supabase/migrasi/ekspor-contoh.json", "utf8"),
);

test("contoh ekspor terbaca sebagai ekspor K-Space V1", () => {
  const hasil = bacaEksporV1(berkas);
  assert.equal(hasil.ok, true);
  if (!hasil.ok) return;

  assert.equal(hasil.meta?.versi, "1.9.2");
  assert.equal(typeof hasil.meta?.diekspor, "string");

  // Kesebelas kunci yang dipetakan harus benar-benar ada isinya, kalau
  // tidak, mode demo memamerkan layar yang separuh kosong.
  for (const k of KUNCI_DIKENAL) {
    const baris = hasil.isi.find((i) => i.kunci === k.kunci);
    assert.ok(baris, `kunci ${k.kunci} tidak ada di contoh ekspor`);
    assert.ok(baris.jumlah > 0, `kunci ${k.kunci} kosong di contoh ekspor`);
  }

  // Kunci yang diabaikan ikut disertakan supaya layar benar-benar
  // menunjukkan bagaimana kunci diabaikan ditandai.
  assert.ok(hasil.isi.some((i) => i.golongan === "diabaikan"));
  assert.ok(hasil.isi.some((i) => i.golongan === "referensi"));
});

test("contoh ekspor tidak memuat satu pun medan kata sandi", () => {
  // Berkasnya ikut dalam repositori; sekali kredensial masuk ke sini,
  // ia ikut ke mana pun repositori disalin.
  const mentah = readFileSync("supabase/migrasi/ekspor-contoh.json", "utf8");
  assert.equal(
    /"(password|passwordHash|password_hash|confirmPassword|salt)"/i.test(
      mentah,
    ),
    false,
  );
});

test("laporan harian di contoh memakai label formulir lama", () => {
  const laporan = (berkas as Record<string, unknown>)["daily-reports:all"];
  assert.ok(Array.isArray(laporan));

  const akun = laporan.find((l) => "Akun" in (l as object)) as Record<
    string,
    unknown
  >;
  // Tanggal laporan datang dari label, bukan dari kolom bernama tanggal.
  assert.equal(typeof akun["Tanggal Laporan"], "string");
  // Angka ditulis sebagai teks berpemisah ribuan, seperti sistem lama.
  assert.match(String(akun.GMV), /^[\d.]+$/);
  // Medan target ikut terekspor; pemetaan yang membuangnya.
  assert.ok("Target GMV" in akun);

  // Laporan non-Affiliator bersasaran unit, tanpa akun.
  const unit = laporan.find((l) => "Unit" in (l as object)) as Record<
    string,
    unknown
  >;
  assert.ok(unit);
  assert.equal("Akun" in unit, false);
});

test("gmv:daily menandai entri yang ditarik otomatis", () => {
  // Tanpa penanda ini, GMV affiliator terhitung dua kali saat dipetakan.
  const harian = (berkas as Record<string, unknown>)["gmv:daily"] as Record<
    string,
    unknown
  >[];
  assert.ok(harian.some((g) => g.autoSynced === true));
  assert.ok(harian.some((g) => g.autoSynced === false));
  assert.equal(golonganKunci("gmv:daily"), "dikenal");
});
