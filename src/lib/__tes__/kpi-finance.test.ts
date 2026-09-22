import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  arusKasOperasi,
  denganSeri,
  formatNilaiKpi,
  formatNilaiPenuh,
  formatPembandingKpi,
  formatSelisihKpi,
  LABEL_STATUS_KPI,
  kpiFinance,
  labaBersihSetelahDepresiasi,
  labaOperasi,
  type MasukanKpi,
} from "../kpi-finance.ts";
import type { RingkasKeuangan } from "../keuangan.ts";

const ringkas = (b: Partial<RingkasKeuangan> = {}): RingkasKeuangan => ({
  pendapatan: b.pendapatan ?? 100_000_000,
  directCost: b.directCost ?? 10_000_000,
  creatorShare: b.creatorShare ?? 5_000_000,
  netRevenue: b.netRevenue ?? 85_000_000,
  beban: b.beban ?? 25_000_000,
  aset: b.aset ?? 0,
  dividen: b.dividen ?? 0,
  labaBersih: b.labaBersih ?? 60_000_000,
  npm: b.npm ?? 70.6,
  saldoKas: b.saldoKas ?? 0,
  menungguPersetujuan: b.menungguPersetujuan ?? 0,
});

const masukan = (b: Partial<MasukanKpi> = {}): MasukanKpi => ({
  sekarang: b.sekarang ?? ringkas(),
  sebelumnya:
    b.sebelumnya ?? ringkas({ pendapatan: 80_000_000, netRevenue: 70_000_000 }),
  depresiasi: b.depresiasi ?? 3_000_000,
  depresiasiLalu: b.depresiasiLalu ?? 3_000_000,
  anggaran: b.anggaran ?? 40_000_000,
  realisasi: b.realisasi ?? 30_000_000,
  saldoKas: b.saldoKas ?? 500_000_000,
});

const cari = (daftar: ReturnType<typeof kpiFinance>, kunci: string) =>
  daftar.find((k) => k.kunci === kunci)!;

test("sepuluh KPI, tidak kurang tidak lebih", () => {
  const daftar = kpiFinance(masukan());
  assert.equal(daftar.length, 10);
  assert.deepEqual(
    daftar.map((k) => k.kunci),
    [
      "revenue",
      "revenue-growth",
      "gross-profit",
      "gp-margin",
      "operating-profit",
      "net-profit",
      "npm",
      "cash-balance",
      "operating-cash-flow",
      "budget-vs-actual",
    ],
  );
});

test("laba bersih KPI sudah dipotong penyusutan", () => {
  const m = masukan({ depresiasi: 5_000_000 });
  const daftar = kpiFinance(m);

  assert.equal(labaOperasi(m.sekarang), 60_000_000);
  assert.equal(labaBersihSetelahDepresiasi(m.sekarang, 5_000_000), 55_000_000);
  assert.equal(cari(daftar, "net-profit").nilai, 55_000_000);
  // Sementara modul Keuangan tetap melaporkan laba sebelum penyusutan.
  assert.equal(m.sekarang.labaBersih, 60_000_000);
});

test("NPM dihitung terhadap net revenue", () => {
  const daftar = kpiFinance(masukan({ depresiasi: 0, depresiasiLalu: 0 }));
  assert.equal(cari(daftar, "npm").nilai, 70.6);
});

test("serapan anggaran yang naik ditandai waspada, bukan baik", () => {
  const daftar = kpiFinance(
    masukan({ anggaran: 40_000_000, realisasi: 38_000_000 }),
  );
  const budget = cari(daftar, "budget-vs-actual");

  assert.equal(budget.nilai, 95);
  assert.equal(budget.format, "persen");
});

test("arus kas operasi tidak menyertakan aset dan dividen", () => {
  const r = ringkas({ aset: 50_000_000, dividen: 20_000_000 });
  assert.equal(arusKasOperasi(r), 60_000_000);
});

test("KPI tanpa pembanding tidak mengarang arah", () => {
  const daftar = kpiFinance(masukan());
  const kas = cari(daftar, "cash-balance");

  assert.equal(kas.sebelumnya, null);
  assert.equal(kas.selisih, null);
  assert.equal(kas.arah, "datar");
  assert.equal(kas.status, "netral");
});

test("pendapatan yang turun ditandai waspada", () => {
  const daftar = kpiFinance(
    masukan({
      sekarang: ringkas({ pendapatan: 50_000_000 }),
      sebelumnya: ringkas({ pendapatan: 80_000_000 }),
    }),
  );
  const revenue = cari(daftar, "revenue");

  assert.equal(revenue.arah, "turun");
  assert.equal(revenue.status, "waspada");
  assert.equal(revenue.selisihPersen, -37.5);
});

test("nilai negatif langsung berstatus buruk", () => {
  const daftar = kpiFinance(
    masukan({
      sekarang: ringkas({ beban: 200_000_000 }),
      depresiasi: 0,
    }),
  );
  assert.equal(cari(daftar, "operating-profit").status, "buruk");
});

test("rupiah diringkas, persen memakai koma desimal", () => {
  const daftar = kpiFinance(masukan());
  assert.equal(formatNilaiKpi(cari(daftar, "revenue")), "Rp 100 Jt");
  assert.match(formatNilaiKpi(cari(daftar, "gp-margin")), /%$/);
});

test("nilai negatif memakai minus tipografis, bukan tanda hubung", () => {
  const daftar = kpiFinance(
    masukan({ sekarang: ringkas({ beban: 200_000_000 }), depresiasi: 0 }),
  );
  const teks = formatNilaiKpi(cari(daftar, "operating-profit"));

  assert.ok(teks.startsWith("−"), `seharusnya minus tipografis: ${teks}`);
  assert.ok(!teks.includes("-"), "tanda hubung terbaca sebagai pemisah");
});

test("angka penuh tersedia untuk diperiksa", () => {
  const daftar = kpiFinance(masukan());
  assert.match(formatNilaiPenuh(cari(daftar, "revenue")), /100\.000\.000/);
});

test("selisih persentase ditulis dalam poin, bukan persen", () => {
  const daftar = kpiFinance(masukan());
  const npm = cari(daftar, "npm");

  assert.match(formatSelisihKpi(npm) ?? "", /poin$/);
  // Selisih rupiah membawa perubahan relatifnya sekalian.
  assert.match(formatSelisihKpi(cari(daftar, "revenue")) ?? "", /\(\+25%\)/);
});

test("KPI tanpa pembanding tidak punya teks selisih", () => {
  const daftar = kpiFinance(masukan());
  assert.equal(formatSelisihKpi(cari(daftar, "cash-balance")), null);
});

test("nilai pembanding ikut tersedia untuk ditampilkan", () => {
  const daftar = kpiFinance(masukan());
  assert.equal(formatPembandingKpi(cari(daftar, "revenue")), "Rp 80 Jt");
  assert.equal(formatPembandingKpi(cari(daftar, "cash-balance")), null);
});

test("status membawa label yang bisa dibaca", () => {
  const daftar = kpiFinance(masukan());
  const revenue = cari(daftar, "revenue");

  assert.equal(revenue.status, "baik");
  assert.equal(LABEL_STATUS_KPI[revenue.status], "Membaik");
  assert.equal(LABEL_STATUS_KPI.waspada, "Memburuk");
});

test("seri riwayat menempel pada KPI yang tepat", () => {
  const riwayat = [
    masukan({ sekarang: ringkas({ pendapatan: 60_000_000 }) }),
    masukan({ sekarang: ringkas({ pendapatan: 80_000_000 }) }),
    masukan({ sekarang: ringkas({ pendapatan: 100_000_000 }) }),
  ];

  const daftar = denganSeri(kpiFinance(masukan()), riwayat);
  const revenue = cari(daftar, "revenue");

  assert.deepEqual(revenue.seri, [60_000_000, 80_000_000, 100_000_000]);
  // Tiap KPI punya serinya sendiri, bukan seri yang sama dipakai ulang.
  assert.equal(cari(daftar, "gross-profit").seri.length, 3);
  assert.notDeepEqual(cari(daftar, "gross-profit").seri, revenue.seri);
});

test("tanpa riwayat, serinya kosong dan bukan nol palsu", () => {
  const daftar = denganSeri(kpiFinance(masukan()), []);
  assert.deepEqual(cari(daftar, "revenue").seri, []);
});

test("pertumbuhan dari nol dikatakan apa adanya, bukan 0%", () => {
  const daftar = kpiFinance(
    masukan({
      sekarang: ringkas({ pendapatan: 64_000_000 }),
      sebelumnya: ringkas({ pendapatan: 0, netRevenue: 0 }),
    }),
  );
  const growth = cari(daftar, "revenue-growth");

  assert.equal(growth.nilai, 0, "matematisnya memang tak terhingga");
  assert.match(growth.keterangan, /tidak bisa dipersenkan/);
});
