import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  akhirPeriode,
  depresiasiPeriode,
  geserPeriode,
  jadwalBulanan,
  jadwalPerPeriode,
  menyusutPada,
  pengaruhLaba,
  periodeDepresiasi,
  ringkasDepresiasi,
  strukturKeuangan,
} from "../depresiasi.ts";
import type { Aset } from "../aset.ts";
import type { RingkasKeuangan } from "../keuangan.ts";

const aset = (b: Partial<Aset> = {}): Aset => ({
  id: b.id ?? Math.random().toString(36),
  kode: b.kode ?? "AST-0001",
  nama: b.nama ?? "Laptop",
  kategori: "Elektronik",
  unitKode: null,
  unitNama: "Perusahaan",
  tanggal: b.tanggal ?? "2024-01-15",
  nilaiPerolehan: b.nilaiPerolehan ?? 12_000_000,
  masaManfaat: b.masaManfaat ?? 24,
  residu: b.residu ?? 0,
  status: b.status ?? "dipakai",
  pemegangId: null,
  pemegangNama: null,
  lokasi: "",
  berakhir: b.berakhir ?? null,
  transaksiId: null,
  catatan: "",
});

test("akhir periode jatuh di hari terakhir bulannya", () => {
  assert.equal(akhirPeriode("2024-02"), "2024-02-29");
  assert.equal(akhirPeriode("2024-10"), "2024-10-31");
  assert.equal(akhirPeriode("2023-02"), "2023-02-28");
});

test("aset berhenti menyusut saat masa manfaatnya habis", () => {
  const a = aset({ tanggal: "2024-01-15", masaManfaat: 6 });
  assert.equal(menyusutPada(a, "2024-05"), true);
  assert.equal(menyusutPada(a, "2024-07"), true, "bulan terakhirnya");
  assert.equal(menyusutPada(a, "2024-09"), false);
});

test("aset yang belum diperoleh atau sudah dilepas tidak menyusut", () => {
  assert.equal(
    menyusutPada(aset({ tanggal: "2024-10-15" }), "2024-09"),
    false,
    "belum dibeli",
  );
  assert.equal(
    menyusutPada(
      aset({ status: "dilepas", berakhir: "2024-08-31" }),
      "2024-10",
    ),
    false,
  );
  // Bulan pelepasannya sendiri masih dihitung.
  assert.equal(
    menyusutPada(
      aset({ status: "dilepas", berakhir: "2024-10-15" }),
      "2024-10",
    ),
    true,
  );
  assert.equal(menyusutPada(aset({ masaManfaat: 0 }), "2024-10"), false);
});

test("beban per aset memakai garis lurus dan diurutkan terbesar dulu", () => {
  const baris = depresiasiPeriode(
    [
      aset({ kode: "A", nilaiPerolehan: 12_000_000, masaManfaat: 24 }),
      aset({ kode: "B", nilaiPerolehan: 6_000_000, masaManfaat: 24 }),
      aset({ kode: "C", masaManfaat: 0 }),
    ],
    "2024-10",
  );

  assert.deepEqual(
    baris.map((b) => b.aset.kode),
    ["A", "B"],
  );
  assert.equal(baris[0].beban, 500_000);
  assert.equal(baris[1].beban, 250_000);
});

test("ringkasan menandai aset yang masa manfaatnya segera habis", () => {
  const r = ringkasDepresiasi(
    depresiasiPeriode(
      [
        aset({ kode: "A", tanggal: "2023-01-15", masaManfaat: 24 }),
        aset({ kode: "B", tanggal: "2024-01-15", masaManfaat: 48 }),
      ],
      "2024-10",
    ),
  );

  assert.equal(r.jumlahAset, 2);
  assert.equal(r.segeraHabis, 1, "aset A tinggal 3 bulan lagi");
});

test("penyusutan menggerus laba dan NPM, tidak pernah menaikkannya", () => {
  const ringkas = {
    pendapatan: 100_000_000,
    directCost: 10_000_000,
    creatorShare: 0,
    netRevenue: 90_000_000,
    beban: 30_000_000,
    aset: 0,
    dividen: 0,
    labaBersih: 60_000_000,
    npm: 66.7,
    saldoKas: 0,
    menungguPersetujuan: 0,
  } satisfies RingkasKeuangan;

  const p = pengaruhLaba(ringkas, 9_000_000);
  assert.equal(p.labaSesudah, 51_000_000);
  assert.equal(p.npmSebelum, 66.7);
  assert.equal(p.npmSesudah, 56.7);
  assert.ok(p.selisihNpm < 0);

  // Tanpa penyusutan, angkanya tidak berubah sama sekali.
  assert.equal(pengaruhLaba(ringkas, 0).selisihNpm, 0);
});

test("periode hanya disebut bila memang ada aset yang menyusut", () => {
  const daftar = [aset({ tanggal: "2024-09-15", masaManfaat: 12 })];
  const periode = periodeDepresiasi(daftar, "2024-10-24", 6);

  assert.deepEqual(periode, ["2024-10", "2024-09"]);
});

test("jadwal bulanan berakhir tepat di nilai residu", () => {
  const a = aset({
    tanggal: "2024-01-15",
    nilaiPerolehan: 12_000_000,
    residu: 2_400_000,
    masaManfaat: 24,
  });
  const baris = jadwalBulanan(a);

  assert.equal(baris.length, 24, "satu baris per bulan masa manfaat");
  assert.equal(baris[0].periode, "2024-02", "bulan pertama genap sebulan");
  assert.equal(baris[0].beban, 400_000);
  assert.equal(baris.at(-1)?.nilaiAkhir, 2_400_000);

  // Nilai awal tiap bulan menyambung nilai akhir bulan sebelumnya.
  for (let i = 1; i < baris.length; i += 1) {
    assert.equal(baris[i].nilaiAwal, baris[i - 1].nilaiAkhir);
  }

  assert.equal(
    baris.reduce((n, b) => n + b.beban, 0),
    12_000_000 - 2_400_000,
    "total beban persis sebesar nilai yang disusutkan",
  );
});

test("aset tanpa masa manfaat tidak punya jadwal bulanan", () => {
  assert.deepEqual(jadwalBulanan(aset({ masaManfaat: 0 })), []);
});

test("periode digeser tanpa salah tahun", () => {
  assert.equal(geserPeriode("2024-10", 3), "2025-01");
  assert.equal(geserPeriode("2024-01", -1), "2023-12");
  assert.equal(geserPeriode("2024-10", 0), "2024-10");
});

test("jadwal per periode menandai bulan yang belum terjadi", () => {
  const baris = jadwalPerPeriode(
    [aset({ tanggal: "2024-01-15", masaManfaat: 24 })],
    "2024-10",
    1,
    2,
  );

  assert.deepEqual(
    baris.map((b) => [b.periode, b.ramalan]),
    [
      ["2024-09", false],
      ["2024-10", false],
      ["2024-11", true],
      ["2024-12", true],
    ],
  );
  assert.ok(baris.every((b) => b.beban === 500_000));
});

test("beban turun saat masa manfaat sebuah aset habis", () => {
  const baris = jadwalPerPeriode(
    [
      aset({ kode: "A", tanggal: "2024-01-15", masaManfaat: 9 }),
      aset({ kode: "B", tanggal: "2024-01-15", masaManfaat: 24 }),
    ],
    "2024-10",
    0,
    1,
  );

  // Aset A berakhir Oktober; November hanya menyisakan B.
  assert.equal(baris[0].jumlahAset, 2);
  assert.equal(baris[1].jumlahAset, 1);
  assert.ok(baris[1].beban < baris[0].beban);
});

test("struktur memisahkan biaya dari yang bukan biaya", () => {
  const ringkas = {
    pendapatan: 100_000_000,
    directCost: 10_000_000,
    creatorShare: 5_000_000,
    netRevenue: 85_000_000,
    beban: 25_000_000,
    aset: 40_000_000,
    dividen: 15_000_000,
    labaBersih: 60_000_000,
    npm: 70.6,
    saldoKas: 0,
    menungguPersetujuan: 0,
  } satisfies RingkasKeuangan;

  const baris = strukturKeuangan(ringkas, 3_000_000);
  const cari = (label: string) => baris.find((b) => b.label === label)!;

  assert.equal(cari("Gross profit").nilai, 85_000_000, "net revenue");
  assert.equal(cari("Operating profit").nilai, 60_000_000);
  assert.equal(cari("Net profit").nilai, 57_000_000, "setelah penyusutan");

  // CAPEX dan dividen besar sekali pun tidak boleh menyentuh laba.
  assert.equal(cari("CAPEX (pembelian aset)").kelompok, "diluar");
  assert.equal(cari("Dividen").kelompok, "diluar");

  const labaDariKomponen = baris
    .filter((b) =>
      ["pendapatan", "cogs", "opex", "depresiasi"].includes(b.kelompok),
    )
    .reduce((n, b) => n + b.nilai, 0);
  assert.equal(labaDariKomponen, cari("Net profit").nilai);
});
