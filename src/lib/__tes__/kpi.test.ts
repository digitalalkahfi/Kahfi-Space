import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  hitungLembarKpi,
  nilaiTangga,
  pecahanKePersen,
  predikatDariSkor,
  ringkasScorecard,
  skorKpi,
  tampilAngkaKpi,
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
    metode: "jabatan",
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

// ---------------------------------------------------------------------
// KPI GRD — tangga 10 kolom (0187)
// ---------------------------------------------------------------------
const GMV = [70, 75, 80, 85, 90, 95, 98, 100, 105, 110];
const TONGGAK = [40, 50, 60, 80, 85, 90, 95, 100, 100, 100];

test("VALUE = kolom paling kanan yang ≤ pencapaian (COUNTIF di file GRD)", () => {
  assert.equal(nilaiTangga(null, GMV), 0);
  assert.equal(nilaiTangga(69.99, GMV), 0);
  assert.equal(nilaiTangga(70, GMV), 1);
  assert.equal(nilaiTangga(84.9, GMV), 3);
  // Kolom 4 = BASE, 8 = GOAL, 10 = STRETCH tertinggi.
  assert.equal(nilaiTangga(85, GMV), 4);
  assert.equal(nilaiTangga(100, GMV), 8);
  assert.equal(nilaiTangga(110, GMV), 10);
  assert.equal(nilaiTangga(500, GMV), 10);
});

test("tangga mendatar di 100% memberi 10, sesuai catatan file", () => {
  assert.equal(nilaiTangga(100, TONGGAK), 10);
  assert.equal(nilaiTangga(99, TONGGAK), 7);
});

test("makin kecil makin baik menghitung kolom yang ≥ pencapaian", () => {
  const komplain = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  assert.equal(nilaiTangga(4, komplain, "turun"), 6);
  assert.equal(nilaiTangga(0, komplain, "turun"), 10);
  assert.equal(nilaiTangga(12, komplain, "turun"), 0);
});

test("NILAI KPI = Σ VALUE × bobot, yang kosong ikut dengan VALUE 0", () => {
  const lembar = (p: (number | null)[]) =>
    hitungLembarKpi([
      { bobot: 40, tangga: GMV, arah: "naik", pencapaian: p[0] },
      { bobot: 40, tangga: GMV, arah: "naik", pencapaian: p[1] },
      { bobot: 20, tangga: TONGGAK, arah: "naik", pencapaian: p[2] },
    ]);

  assert.deepEqual(lembar([92, 96, 77.8]), {
    total: 500,
    predikat: "Cukup",
    cakupan: 100,
  });
  // 98% / 98% / 100%: GRD 760 (Baik); rumus lama memberi 808 (Istimewa).
  assert.deepEqual(lembar([98, 98, 100]), {
    total: 760,
    predikat: "Baik",
    cakupan: 100,
  });
  assert.deepEqual(lembar([110, 110, 100]), {
    total: 1000,
    predikat: "Istimewa",
    cakupan: 100,
  });
  // Satu kosong: tetap dihitung 0, bukan dibuang lalu bobotnya dinormalkan.
  assert.deepEqual(lembar([null, 100, null]), {
    total: 320,
    predikat: "Perlu Perbaikan",
    cakupan: 40,
  });
  // Semua kosong: "BELUM DIISI".
  assert.deepEqual(lembar([null, null, null]), {
    total: 0,
    predikat: null,
    cakupan: 0,
  });
});

test("persen pecahan dari file dibaca tanpa sisa floating point", () => {
  assert.equal(0.07 * 100 === 7, false);
  assert.equal(pecahanKePersen(0.07), 7);
  assert.equal(pecahanKePersen(0.825), 82.5);
  assert.equal(pecahanKePersen(0.875), 87.5);
  assert.equal(pecahanKePersen(1.05), 105);
  // Pencapaian tepat di ambang tetap jatuh di kolomnya.
  const tangga = [0.55, 0.65, 0.75, 0.85, 0.9, 0.95, 0.98, 1, 1, 1].map(
    pecahanKePersen,
  );
  assert.equal(nilaiTangga(pecahanKePersen(0.98), tangga), 7);
});

test("angka KPI tampil sesuai satuannya", () => {
  assert.equal(tampilAngkaKpi(92.5, "%"), "92,5%");
  assert.equal(tampilAngkaKpi(103.25, "video/hari"), "103,25 video/hari");
  assert.equal(tampilAngkaKpi(1500, "creator"), "1.500 creator");
});

function barisGrd(skor: number, terisi: boolean): BarisScorecard {
  return {
    userId: `g${skor}-${terisi}`,
    nama: "Contoh",
    inisial: "C",
    jabatan: "Staff",
    unit: "Affiliator",
    skor,
    predikat: terisi ? predikatDariSkor(skor) : null,
    cakupan: terisi ? 60 : 0,
    metode: "grd",
    rincian: [],
    terkunci: false,
    bolehMenilai: false,
  };
}

test("rata-rata GRD menghitung yang sudah dinilai walau sebagian kosong", () => {
  // Pada GRD yang kosong bernilai 0, jadi cakupan 60% tetap nilai sah;
  // yang belum diisi sama sekali belum punya nilai.
  const ringkas = ringkasScorecard([
    barisGrd(700, true),
    barisGrd(500, true),
    barisGrd(0, false),
  ]);
  assert.equal(ringkas.rataRata, 600);
  assert.equal(ringkas.dinilai, 2);
  assert.equal(ringkas.parsial, 1);
});
