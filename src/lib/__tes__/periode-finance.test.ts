import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  acuanRentang,
  bacaJenisPeriode,
  geserRentang,
  hariDalamBulan,
  hariDalamRentang,
  prorata,
  rentangPeriode,
  rentangSebelumnya,
  satuanPeriode,
} from "../periode-finance.ts";

test("periode harian hanya sehari", () => {
  const r = rentangPeriode("harian", "2024-10-24");
  assert.equal(r.dari, "2024-10-24");
  assert.equal(r.sampai, "2024-10-24");
  assert.equal(r.label, "24 Oktober 2024");
});

test("pekan dimulai Senin, bukan Minggu", () => {
  // 24 Oktober 2024 jatuh Kamis; pekannya Senin 21 – Minggu 27.
  const r = rentangPeriode("mingguan", "2024-10-24");
  assert.equal(r.dari, "2024-10-21");
  assert.equal(r.sampai, "2024-10-27");

  // Senin sendiri tidak ditarik mundur ke pekan sebelumnya.
  assert.equal(rentangPeriode("mingguan", "2024-10-21").dari, "2024-10-21");
  // Minggu adalah hari terakhir pekannya, bukan hari pertama.
  assert.equal(rentangPeriode("mingguan", "2024-10-27").dari, "2024-10-21");
});

test("bulanan dan tahunan mengikuti kalender", () => {
  const bulan = rentangPeriode("bulanan", "2024-10-24");
  assert.equal(bulan.dari, "2024-10-01");
  assert.equal(bulan.sampai, "2024-10-31");
  assert.equal(bulan.label, "Oktober 2024");

  // Februari kabisat tidak boleh dipotong 28 hari.
  assert.equal(rentangPeriode("bulanan", "2024-02-10").sampai, "2024-02-29");

  const tahun = rentangPeriode("tahunan", "2024-10-24");
  assert.equal(tahun.dari, "2024-01-01");
  assert.equal(tahun.sampai, "2024-12-31");
});

test("rentang custom yang terbalik ditukar, bukan dikosongkan", () => {
  const r = rentangPeriode("custom", "2024-10-24", {
    dari: "2024-10-20",
    sampai: "2024-10-05",
  });
  assert.equal(r.dari, "2024-10-05");
  assert.equal(r.sampai, "2024-10-20");
});

test("pembanding bulanan memakai bulan kalender sebelumnya", () => {
  const lalu = rentangSebelumnya(rentangPeriode("bulanan", "2024-10-24"));
  assert.equal(lalu.dari, "2024-09-01");
  assert.equal(lalu.sampai, "2024-09-30");
});

test("pembanding mingguan dan harian mundur sepanjang rentangnya", () => {
  const pekan = rentangSebelumnya(rentangPeriode("mingguan", "2024-10-24"));
  assert.equal(pekan.dari, "2024-10-14");
  assert.equal(pekan.sampai, "2024-10-20");

  const hari = rentangSebelumnya(rentangPeriode("harian", "2024-10-01"));
  assert.equal(hari.dari, "2024-09-30");
  assert.equal(hari.sampai, "2024-09-30");
});

test("pembanding tahunan mundur satu tahun penuh", () => {
  const lalu = rentangSebelumnya(rentangPeriode("tahunan", "2024-05-10"));
  assert.equal(lalu.dari, "2023-01-01");
  assert.equal(lalu.sampai, "2023-12-31");
});

test("jenis periode yang tidak dikenal jatuh ke bulanan", () => {
  assert.equal(bacaJenisPeriode("mingguan"), "mingguan");
  assert.equal(bacaJenisPeriode("entah"), "bulanan");
  assert.equal(bacaJenisPeriode(undefined), "bulanan");
});

test("menggeser periode bulanan mendarat di bulan kalender", () => {
  const okt = rentangPeriode("bulanan", "2024-10-24");
  const sep = geserRentang(okt, -1);

  assert.equal(sep.dari, "2024-09-01");
  assert.equal(sep.sampai, "2024-09-30");
  assert.equal(geserRentang(sep, 1).dari, "2024-10-01");
});

test("menggeser pekan tetap Senin–Minggu", () => {
  const pekan = rentangPeriode("mingguan", "2024-10-24");
  const lalu = geserRentang(pekan, -1);

  assert.equal(lalu.dari, "2024-10-14");
  assert.equal(lalu.sampai, "2024-10-20");
});

test("rentang custom digeser sepanjang dirinya sendiri", () => {
  const custom = rentangPeriode("custom", "2024-10-24", {
    dari: "2024-10-01",
    sampai: "2024-10-10",
  });
  const lalu = geserRentang(custom, -1);

  assert.equal(lalu.dari, "2024-09-21");
  assert.equal(lalu.sampai, "2024-09-30");
});

test("menggeser tahun dan hari tidak melompati batas kalender", () => {
  assert.equal(
    geserRentang(rentangPeriode("tahunan", "2024-06-01"), -1).dari,
    "2023-01-01",
  );
  assert.equal(
    geserRentang(rentangPeriode("harian", "2024-01-01"), -1).dari,
    "2023-12-31",
  );
});

test("acuan rentang diambil dari hari pertamanya", () => {
  assert.equal(
    acuanRentang(rentangPeriode("bulanan", "2024-10-24")),
    "2024-10-01",
  );
});

test("prorata membagi angka bulanan sesuai panjang rentang", () => {
  const sebulan = rentangPeriode("bulanan", "2024-10-24");
  const sepekan = rentangPeriode("mingguan", "2024-10-24");
  const sehari = rentangPeriode("harian", "2024-10-24");

  // Oktober 31 hari: sepekan ≈ 7/31, sehari ≈ 1/31.
  assert.equal(prorata(31_000_000, sebulan), 31_000_000);
  assert.equal(prorata(31_000_000, sepekan), 7_000_000);
  assert.equal(prorata(31_000_000, sehari), 1_000_000);
  // Setahun = dua belas kali angka bulanannya.
  assert.equal(
    prorata(1_000_000, rentangPeriode("tahunan", "2024-10-24")),
    12_000_000,
  );
});

test("panjang rentang dihitung inklusif", () => {
  assert.equal(
    hariDalamRentang({ dari: "2024-10-01", sampai: "2024-10-31" }),
    31,
  );
  assert.equal(
    hariDalamRentang({ dari: "2024-10-24", sampai: "2024-10-24" }),
    1,
  );
  assert.equal(hariDalamBulan("2024-02-10"), 29);
});

test("satuan periode ikut jenis filternya", () => {
  assert.equal(satuanPeriode("bulanan"), "bulan");
  assert.equal(satuanPeriode("mingguan"), "pekan");
  assert.equal(satuanPeriode("harian"), "hari");
  assert.equal(satuanPeriode("tahunan"), "tahun");
  assert.equal(satuanPeriode("custom"), "rentang");
});
