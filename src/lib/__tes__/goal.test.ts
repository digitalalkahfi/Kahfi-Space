import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  akhirPeriode,
  anakTangga,
  bolehJadiInduk,
  jumlahBulanAntara,
  labelPeriode,
  periodeKuartal,
  pilihanBulanMulai,
  statusPeriode,
  susunAnakTangga,
  tebakModeTarget,
} from "../goal.ts";
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

test("label periode sebulan, setahun, dan menyeberang tahun", () => {
  assert.equal(labelPeriode("2026-10-01", 1), "Okt 2026");
  assert.equal(labelPeriode("2026-10-01", 3), "Okt – Des 2026");
  assert.equal(labelPeriode("2026-11-01", 3), "Nov 2026 – Jan 2027");
  assert.equal(labelPeriode("2026-01-01", 12), "Jan – Des 2026");
});

test("akhir periode dan jumlah bulan saling menghitung balik", () => {
  assert.equal(akhirPeriode("2026-10-01", 1), "2026-10-01");
  assert.equal(akhirPeriode("2026-11-01", 3), "2027-01-01");
  assert.equal(jumlahBulanAntara("2026-11-01", "2027-01-01"), 3);
  assert.equal(jumlahBulanAntara("2026-10-01", "2026-10-01"), 1);
});

test("target sama setiap bulan tidak dibagi", () => {
  const tangga = susunAnakTangga("2026-10-01", 3, 32_000_000_000, "bulanan");
  assert.deepEqual(
    tangga.map((t) => t.bulan),
    ["2026-10-01", "2026-11-01", "2026-12-01"],
  );
  assert.ok(tangga.every((t) => t.target === 32_000_000_000));
});

test("target total dibagi rata dan jumlahnya tetap persis", () => {
  const tangga = susunAnakTangga("2026-10-01", 3, 100, "total");
  assert.deepEqual(
    tangga.map((t) => t.target),
    [33, 33, 34],
  );
});

test("cara baca target ditebak dari anak tangganya", () => {
  assert.equal(tebakModeTarget([{ target: 5 }], 5), "bulanan");
  assert.equal(tebakModeTarget([{ target: 5 }, { target: 5 }], 5), "bulanan");
  assert.equal(tebakModeTarget([{ target: 3 }, { target: 7 }], 10), "total");
  assert.equal(
    tebakModeTarget([{ target: 1 }, { target: 2 }, { target: 4 }], 1),
    "kustom",
    "target menanjak ala data lama",
  );
});

test("status periode terhadap tanggal acuan", () => {
  assert.equal(statusPeriode("2026-10-01", 1, "2026-09-28"), "belum");
  assert.equal(statusPeriode("2026-10-01", 3, "2026-11-15"), "berjalan");
  assert.equal(statusPeriode("2026-09-01", 1, "2026-10-02"), "lewat");
});

test("pilihan bulan mulai mencakup bulan yang sedang dipakai goal", () => {
  const p = pilihanBulanMulai("2026-09-28");
  assert.equal(p[0], "2026-06-01", "tiga bulan ke belakang");
  assert.equal(p.at(-1), "2027-09-01", "setahun ke depan");
  assert.ok(p.includes("2026-10-01"));
  const lama = pilihanBulanMulai("2026-09-28", "2025-01-01");
  assert.equal(
    lama[0],
    "2025-01-01",
    "bulan lama sebuah goal tetap bisa dipilih",
  );
});
