import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  hariJendela,
  HARI_DIAGRAM,
  lingkupCapaian,
  rasioCapaianAngka,
  rentangDiagram,
  totalHarian,
  warnaCapaian,
  type AngkaCapaian,
} from "@/lib/capaian";

test("ambang warna mengikuti PRD: 100, 80, dan di bawahnya", () => {
  assert.equal(warnaCapaian(140), "hijau");
  assert.equal(warnaCapaian(100), "hijau", "tepat 100% sudah hijau");
  assert.equal(warnaCapaian(99.9), "kuning");
  assert.equal(warnaCapaian(80), "kuning", "tepat 80% masih kuning");
  assert.equal(warnaCapaian(79.9), "merah");
  assert.equal(warnaCapaian(0), "merah");
});

test("tanpa target tidak ada warna sama sekali", () => {
  // Menandai merah angka yang memang tidak punya target adalah tuduhan.
  assert.equal(warnaCapaian(0, false), null);
  assert.equal(warnaCapaian(150, false), null);
});

test("jendela diagram 28 hari dan berakhir pada tanggalnya", () => {
  const { dari, sampai } = rentangDiagram("2024-10-24");
  assert.equal(sampai, "2024-10-24");
  assert.equal(dari, "2024-09-27");
  const hari = hariJendela("2024-10-24");
  assert.equal(hari.length, HARI_DIAGRAM);
  assert.equal(hari[0], "2024-09-27");
  assert.equal(hari.at(-1), "2024-10-24");
});

test("jendela menyeberang pergantian bulan dan tahun dengan benar", () => {
  const hari = hariJendela("2025-01-05", 7);
  assert.deepEqual(hari, [
    "2024-12-30",
    "2024-12-31",
    "2025-01-01",
    "2025-01-02",
    "2025-01-03",
    "2025-01-04",
    "2025-01-05",
  ]);
});

test("totalHarian menjumlahkan target dan realisasi terpisah", () => {
  const hasil = totalHarian([
    { tanggal: "2024-10-01", target: 100, realisasi: 90 },
    { tanggal: "2024-10-02", target: 100, realisasi: 130 },
  ]);
  assert.deepEqual(hasil, { target: 200, realisasi: 220 });
  assert.deepEqual(totalHarian([]), { target: 0, realisasi: 0 });
});

test("rasio angka tanpa target bernilai null, bukan nol atau tak hingga", () => {
  const dasar: AngkaCapaian = {
    kunci: "komisi",
    label: "Komisi",
    realisasi: 500,
    target: null,
    satuan: "rupiah",
  };
  assert.equal(rasioCapaianAngka(dasar), null);
  assert.equal(rasioCapaianAngka({ ...dasar, target: 0 }), null);
  assert.equal(rasioCapaianAngka({ ...dasar, target: 1000 }), 50);
});

test("lingkup menyebut satu sasaran apa adanya, banyak sasaran diringkas", () => {
  assert.equal(lingkupCapaian([]), "Belum ada sasaran");
  assert.equal(lingkupCapaian(["@toko"]), "@toko");
  assert.equal(lingkupCapaian(["@toko", "@lain"]), "@toko & 1 lainnya");
  assert.equal(lingkupCapaian(["@a", "@b", "@c"]), "@a & 2 lainnya");
});
