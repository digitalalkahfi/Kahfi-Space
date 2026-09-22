import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  predikatDariSkor,
  ringkasScorecard,
  skorKpi,
  type BarisScorecard,
} from "../kpi.ts";

test("tangga skor menyentuh 500, 800, dan 1.000 tepat di ambangnya", () => {
  assert.equal(skorKpi(100, 100, 200, 300), 500);
  assert.equal(skorKpi(200, 100, 200, 300), 800);
  assert.equal(skorKpi(300, 100, 200, 300), 1000);
});

test("di antara ambang, skornya naik lurus", () => {
  assert.equal(skorKpi(150, 100, 200, 300), 650);
  assert.equal(skorKpi(250, 100, 200, 300), 900);
  assert.equal(skorKpi(50, 100, 200, 300), 250);
});

test("skor tidak pernah melewati skala 1.000 maupun turun di bawah 0", () => {
  assert.equal(skorKpi(999_999, 100, 200, 300), 1000);
  assert.equal(skorKpi(0, 100, 200, 300), 0);
  assert.equal(skorKpi(-100, 100, 200, 300), 0);
});

test("indikator tanpa ambang minimum diukur terhadap goal-nya", () => {
  // base 0 berarti tidak ada ambang bawah; 100% goal tetap bernilai 800.
  assert.equal(skorKpi(200, 0, 200, 300), 800);
  assert.equal(skorKpi(100, 0, 200, 300), 400);
});

test("predikat mengikuti ambang PRD", () => {
  assert.equal(predikatDariSkor(1000), "Istimewa");
  assert.equal(predikatDariSkor(800), "Istimewa");
  assert.equal(predikatDariSkor(799.9), "Baik");
  assert.equal(predikatDariSkor(650), "Baik");
  assert.equal(predikatDariSkor(649.9), "Cukup");
  assert.equal(predikatDariSkor(500), "Cukup");
  assert.equal(predikatDariSkor(499.9), "Perlu Perbaikan");
  assert.equal(predikatDariSkor(0), "Perlu Perbaikan");
});

function baris(skor: number, cakupan: number): BarisScorecard {
  return {
    userId: `u${skor}-${cakupan}`,
    nama: "Contoh",
    inisial: "C",
    jabatan: "Staff",
    unit: "Affiliator",
    skor,
    predikat: predikatDariSkor(skor),
    cakupan,
    rincian: [],
    terkunci: false,
  };
}

test("rata-rata tim hanya menghitung yang terukur penuh", () => {
  // Skor dari cakupan sebagian bertumpu pada sebagian bobot saja; kalau
  // ikut dirata-rata, angka tim jadi tidak berarti.
  const ringkas = ringkasScorecard([
    baris(800, 100),
    baris(600, 100),
    baris(1000, 25),
  ]);
  assert.equal(ringkas.rataRata, 700);
  assert.equal(ringkas.dinilai, 2);
  assert.equal(ringkas.parsial, 1);
  assert.equal(ringkas.total, 3);
});

test("tim yang belum terukur sama sekali tidak dipaksa punya rata-rata", () => {
  const ringkas = ringkasScorecard([baris(900, 50), baris(300, 0)]);
  assert.equal(ringkas.rataRata, 0);
  assert.equal(ringkas.dinilai, 0);
  assert.equal(ringkas.parsial, 2);
});

test("daftar kosong tidak menghasilkan pembagian nol", () => {
  assert.deepEqual(ringkasScorecard([]), {
    rataRata: 0,
    dinilai: 0,
    parsial: 0,
    total: 0,
  });
});
