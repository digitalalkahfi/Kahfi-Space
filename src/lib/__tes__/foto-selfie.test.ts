import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  BATAS_UMUR_FOTO_MENIT,
  fotoMasihBaru,
  ukuranKecil,
} from "@/lib/foto-selfie";

test("foto dikecilkan ke lebar 720 dengan perbandingan sisi tetap", () => {
  assert.deepEqual(ukuranKecil(4000, 3000), { lebar: 720, tinggi: 540 });
  assert.deepEqual(ukuranKecil(3000, 4000), { lebar: 720, tinggi: 960 });
  // Foto yang sudah kecil tidak diperbesar.
  assert.deepEqual(ukuranKecil(640, 480), { lebar: 640, tinggi: 480 });
  assert.deepEqual(ukuranKecil(0, 480), { lebar: 0, tinggi: 0 });
});

test("foto dari kamera HP harus baru; foto galeri lama ditolak", () => {
  const sekarang = Date.UTC(2026, 9, 20, 1, 0);
  assert.equal(fotoMasihBaru(sekarang - 30_000, sekarang), true);
  assert.equal(
    fotoMasihBaru(sekarang - BATAS_UMUR_FOTO_MENIT * 60_000, sekarang),
    true,
  );
  assert.equal(
    fotoMasihBaru(sekarang - (BATAS_UMUR_FOTO_MENIT * 60_000 + 1), sekarang),
    false,
  );
  // Peramban yang tidak mengisi lastModified tidak dihukum.
  assert.equal(fotoMasihBaru(0, sekarang), true);
});
