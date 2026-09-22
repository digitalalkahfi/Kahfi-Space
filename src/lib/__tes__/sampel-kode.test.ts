import { strict as assert } from "node:assert";
import { test } from "node:test";
import { normalkanKode } from "../sampel.ts";

test("kode biasa dikembalikan dalam huruf besar", () => {
  assert.equal(normalkanKode("smp-0003"), "SMP-0003");
  assert.equal(normalkanKode("  SMP-0003  "), "SMP-0003");
});

test("tautan pada stiker cetakan lama tetap mengarah ke kodenya", () => {
  assert.equal(
    normalkanKode("https://kspace.alkahfi.co.id/sampel/SMP-0003"),
    "SMP-0003",
  );
  assert.equal(
    normalkanKode("https://kspace.alkahfi.co.id/sampel/SMP-0003?dari=stiker"),
    "SMP-0003",
  );
});

test("awalan jenis isi dari pembaca QR diabaikan", () => {
  assert.equal(normalkanKode("kode: SMP-0007"), "SMP-0007");
  assert.equal(normalkanKode("SAMPLE=SMP-0007"), "SMP-0007");
});

test("baris kedua adalah keterangan cetak, bukan kodenya", () => {
  assert.equal(normalkanKode("SMP-0007\nSerum Vitamin C"), "SMP-0007");
});

test("spasi tak-putus dari sebagian pembaca ikut dibersihkan", () => {
  assert.equal(normalkanKode(" SMP-0007 "), "SMP-0007");
});

test("isi yang bukan kode tidak dipaksa menjadi kode", () => {
  // Lebih baik tercatat sebagai kode asing daripada salah menunjuk barang.
  for (const isi of ["", "   ", "halo dunia", "SM", "https://", "SMP 0003"]) {
    assert.equal(normalkanKode(isi), "", `"${isi}" seharusnya tidak terbaca`);
  }
});

test("kode terlalu panjang ditolak, bukan dipotong", () => {
  assert.equal(normalkanKode("A".repeat(31)), "");
  assert.equal(normalkanKode("A".repeat(30)), "A".repeat(30));
});
