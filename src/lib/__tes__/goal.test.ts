import { strict as assert } from "node:assert";
import { test } from "node:test";
import { anakTangga, bolehJadiInduk, periodeKuartal } from "../goal.ts";
import { geserBulan } from "../kalender.ts";

test("geser bulan menyeberangi pergantian tahun", () => {
  assert.equal(geserBulan("2024-10-01", 0), "2024-10-01");
  assert.equal(geserBulan("2024-10-01", 3), "2025-01-01");
  assert.equal(geserBulan("2024-01-01", 11), "2024-12-01");
});

test("anak tangga selalu berjumlah persis target goal", () => {
  // Pembagian yang menyisakan pecahan tidak boleh menguapkan target:
  // sisa pembulatan dijatuhkan ke bulan terakhir.
  for (const target of [1_000_000, 1_162_500_000, 7, 999]) {
    for (const bulan of [1, 3, 6, 12]) {
      const tangga = anakTangga("2024-10-01", bulan, target);
      assert.equal(tangga.length, bulan);
      assert.equal(
        tangga.reduce((a, t) => a + t.target, 0),
        target,
        `${target} dibagi ${bulan} bulan`,
      );
    }
  }
});

test("anak tangga berderet bulan demi bulan mulai tanggal 1", () => {
  const tangga = anakTangga("2024-11-01", 3, 300);
  assert.deepEqual(
    tangga.map((t) => t.bulan),
    ["2024-11-01", "2024-12-01", "2025-01-01"],
  );
});

test("induk goal harus lebih tinggi di tangga roll-down", () => {
  assert.equal(bolehJadiInduk("leader", "manager"), true);
  assert.equal(bolehJadiInduk("account", "company"), true);
  assert.equal(bolehJadiInduk("manager", "leader"), false);
  assert.equal(bolehJadiInduk("leader", "leader"), false);
});

test("periode goal mengikuti kuartal tanggalnya", () => {
  assert.equal(periodeKuartal("2024-10-21"), "2024-Q4");
  assert.equal(periodeKuartal("2024-01-01"), "2024-Q1");
  assert.equal(periodeKuartal("2025-06-30"), "2025-Q2");
});
