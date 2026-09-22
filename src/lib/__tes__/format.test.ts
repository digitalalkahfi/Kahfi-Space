import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bulanPanjang,
  bulanPendek,
  jamWib,
  tanggalPanjang,
  tanggalPendek,
} from "../format.ts";

test("label bulan memakai nama bulan Indonesia", () => {
  assert.equal(bulanPanjang("2024-10-01"), "Oktober 2024");
  assert.equal(bulanPanjang("2024-01-01"), "Januari 2024");
  assert.equal(bulanPanjang("2024-05-01"), "Mei 2024");
});

test("label bulan tidak mundur karena zona waktu", () => {
  // Tanggal 1 yang diurai sebagai waktu lokal di zona barat Greenwich
  // akan mundur ke bulan sebelumnya; label harus tetap bulan itu.
  assert.equal(bulanPanjang("2024-10-15"), "Oktober 2024");
  assert.equal(bulanPendek("2024-03-01"), "Mar 2024");
});

test("tanggal panjang memuat nama hari Indonesia", () => {
  // 24 Oktober 2024 jatuh pada Kamis.
  const teks = tanggalPanjang("2024-10-24T03:00:00Z");
  assert.match(teks, /Kamis/);
  assert.match(teks, /Oktober/);
  assert.match(teks, /2024/);
});

test("tanggal pendek memakai singkatan Indonesia", () => {
  assert.match(tanggalPendek("2024-10-24T03:00:00Z"), /Okt/);
});

test("jam ditulis 24 jam dengan penanda WIB", () => {
  // 07:48 WIB = 00:48 UTC.
  assert.equal(jamWib("2024-10-24T00:48:00Z"), "07:48 WIB");
  assert.equal(jamWib("2024-10-24T10:00:00Z"), "17:00 WIB");
});

test("jam memakai titik dua, bukan titik", () => {
  // Lokal id-ID menulis 07.48; yang dipakai di layar adalah 07:48.
  assert.equal(jamWib("2024-10-24T00:48:00Z").includes("."), false);
});

test("tengah malam WIB tidak berubah menjadi 24", () => {
  assert.equal(jamWib("2024-10-23T17:00:00Z"), "00:00 WIB");
});
