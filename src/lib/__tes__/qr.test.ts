import { strict as assert } from "node:assert";
import { test } from "node:test";
import { jalurQr, petaQr, TEPI_QR } from "../qr.ts";

test("menghasilkan matriks persegi", () => {
  const peta = petaQr("SMP-0001");
  assert.equal(peta.modul.length, peta.ukuran);
  for (const baris of peta.modul) {
    assert.equal(baris.length, peta.ukuran);
  }
});

test("pola pencari ada di tiga sudut", () => {
  // Tanpa ketiganya, pemindai tidak bisa menemukan orientasi kodenya.
  const { modul, ukuran } = petaQr("SMP-0001");
  const pencari = (baris: number, kolom: number) =>
    modul[baris][kolom] &&
    modul[baris][kolom + 6] &&
    modul[baris + 6][kolom] &&
    !modul[baris + 1][kolom + 1];

  assert.equal(pencari(0, 0), true, "kiri atas");
  assert.equal(pencari(0, ukuran - 7), true, "kanan atas");
  assert.equal(pencari(ukuran - 7, 0), true, "kiri bawah");
});

test("isi berbeda menghasilkan pola berbeda", () => {
  const a = jalurQr(petaQr("SMP-0001"));
  const b = jalurQr(petaQr("SMP-0002"));
  assert.notEqual(a, b);
});

test("isi sama menghasilkan pola sama", () => {
  assert.equal(jalurQr(petaQr("SMP-0001")), jalurQr(petaQr("SMP-0001")));
});

test("jalur SVG berisi perintah gambar yang sah", () => {
  const jalur = jalurQr(petaQr("SMP-0001"));
  assert.match(jalur, /^M\d+ \d+h1v1h-1z/);
  assert.equal(jalur.includes("NaN"), false);
});

test("kode panjang tetap tertangani", () => {
  const peta = petaQr("SMP-" + "0".repeat(56));
  assert.equal(peta.ukuran > 21, true, "matriksnya harus membesar");
});

test("tepi kosong mengikuti standar", () => {
  assert.equal(TEPI_QR, 4);
});
