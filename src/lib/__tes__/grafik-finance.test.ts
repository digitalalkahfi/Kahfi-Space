import { strict as assert } from "node:assert";
import { test } from "node:test";
import { seriGrafik } from "../grafik-finance.ts";
import type { MasukanKpi } from "../kpi-finance.ts";
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
  menungguPersetujuan: 0,
});

const masukan = (pendapatan: number, depresiasi = 3_000_000): MasukanKpi => ({
  sekarang: ringkas({ pendapatan, netRevenue: pendapatan - 15_000_000 }),
  sebelumnya: ringkas(),
  depresiasi,
  depresiasiLalu: depresiasi,
  anggaran: 40_000_000,
  realisasi: 30_000_000,
  saldoKas: 0,
});

test("seri grafik berpasangan dengan labelnya menurut urutan", () => {
  const seri = seriGrafik(
    [masukan(80_000_000), masukan(100_000_000)],
    ["September", "Oktober"],
  );

  assert.deepEqual(
    seri.revenue.map((t) => [t.label, t.nilai]),
    [
      ["September", 80_000_000],
      ["Oktober", 100_000_000],
    ],
  );
});

test("net profit pada grafik sudah dipotong penyusutan", () => {
  const seri = seriGrafik([masukan(100_000_000, 5_000_000)], ["Oktober"]);

  // net revenue 85 Jt − beban 25 Jt − depresiasi 5 Jt.
  assert.equal(seri.labaBersih[0].nilai, 55_000_000);
  assert.equal(seri.labaOperasi[0].nilai, 60_000_000);
});

test("komposisi biaya memuat empat bagian yang dulu tercampur", () => {
  const seri = seriGrafik([masukan(100_000_000)], ["Oktober"]);
  const kolom = seri.komposisi[0];

  assert.deepEqual(
    kolom.bagian.map((b) => b.label),
    ["Direct cost", "Creator share", "Beban", "Depresiasi"],
  );
  assert.equal(
    kolom.total,
    kolom.bagian.reduce((n, b) => n + b.nilai, 0),
  );
});

test("NPM grafik nol saat net revenue nol, bukan tak terhingga", () => {
  const kosong: MasukanKpi = {
    ...masukan(0),
    sekarang: ringkas({ pendapatan: 0, netRevenue: 0, beban: 0 }),
  };
  const seri = seriGrafik([kosong], ["Oktober"]);
  assert.equal(seri.npm[0].nilai, 0);
});
