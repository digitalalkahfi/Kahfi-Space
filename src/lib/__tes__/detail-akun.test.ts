import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  HARI_GRAFIK_HARIAN,
  daftarTanggal,
  dalamRentang,
  rentangGrafik,
  ringkasAkun,
  sejajarkan,
  sorotanAkun,
  barisHarian,
  statusHari,
  susunHari,
  titikMetrik,
  type HariAkun,
} from "@/lib/detail-akun";
import { rentangPeriode } from "@/lib/periode-finance";

const hari = (p: Partial<HariAkun> & { tanggal: string }): HariAkun => ({
  lapor: true,
  gmv: 0,
  upload: null,
  komisi: null,
  hariKerja: true,
  ...p,
});

test("status hari: memenuhi, di bawah minimum, tidak lapor, libur/izin", () => {
  assert.equal(statusHari(hari({ tanggal: "x", upload: 5 }), 5), "memenuhi");
  assert.equal(statusHari(hari({ tanggal: "x", upload: 4 }), 5), "kurang");
  assert.equal(
    statusHari(hari({ tanggal: "x", lapor: false, hariKerja: true }), 5),
    "tidak-lapor",
  );
  assert.equal(
    statusHari(hari({ tanggal: "x", lapor: false, hariKerja: false }), 5),
    "libur",
  );
  // Akun tanpa level tidak punya batas.
  assert.equal(statusHari(hari({ tanggal: "x", upload: 1 }), null), "terlapor");
  // Lapor di hari PIC tidak absen masuk: tidak dinilai, sama dengan kepatuhan.
  assert.equal(
    statusHari(hari({ tanggal: "x", upload: 1, hariKerja: false }), 5),
    "terlapor",
  );
});

test("tabel harian sepakat dengan sorotan dan kepatuhan", () => {
  const h = [
    hari({ tanggal: "2024-10-01", upload: 5 }),
    hari({ tanggal: "2024-10-02", upload: 1 }),
    hari({ tanggal: "2024-10-03", upload: 1, hariKerja: false }),
    hari({ tanggal: "2024-10-04", lapor: false, hariKerja: true }),
    hari({ tanggal: "2024-10-05", lapor: false, hariKerja: false }),
  ];
  const b = barisHarian(h, 3);
  const n = (s: string) => b.filter((x) => x.status === s).length;
  assert.equal(
    n("kurang") + n("tidak-lapor"),
    sorotanAkun(h, 3).hariDiBawahMinimum,
  );
  // Hari kerja = hari yang dinilai (Memenuhi + Di bawah + Tidak lapor).
  assert.equal(
    n("memenuhi") + n("kurang") + n("tidak-lapor"),
    ringkasAkun(h).hariKerja,
  );
});

test("susunHari: hari tanpa laporan tidak bernilai, komisi hanya bila diberikan", () => {
  const tgl = daftarTanggal("2024-10-01", "2024-10-03");
  assert.deepEqual(tgl, ["2024-10-01", "2024-10-02", "2024-10-03"]);
  const laporan = new Map([["2024-10-01", { gmv: 100, upload: 3 }]]);
  const [a, b] = susunHari(tgl, laporan, null, new Set(["2024-10-02"]));
  assert.deepEqual(
    [a.lapor, a.gmv, a.komisi, b.lapor, b.hariKerja],
    [true, 100, null, false, true],
  );
  const [k] = susunHari(tgl, laporan, new Map([["2024-10-01", 7]]), new Set());
  assert.equal(k.komisi, 7);
});

test("AC8: hari kerja tanpa laporan → celah berlabel 'tidak lapor', bukan nol", () => {
  const t = titikMetrik(
    [
      hari({ tanggal: "2024-10-01", gmv: 100 }),
      hari({ tanggal: "2024-10-02", lapor: false, hariKerja: true }),
      hari({ tanggal: "2024-10-03", lapor: false, hariKerja: false }),
    ],
    "gmv",
    "harian",
  );
  assert.deepEqual(t[0], { label: "1 Okt", nilai: 100 });
  assert.equal(t[1].kosong, true);
  assert.equal(t[1].catatan, "tidak lapor");
  assert.equal(t[1].tandai, true);
  // Libur/izin: celah polos, tidak ditandai sebagai tidak lapor.
  assert.equal(t[2].kosong, true);
  assert.equal(t[2].tandai, false);
});

test("AC9: mode Harian → 14 hari terakhir; Tahunan → titik per bulan", () => {
  const harian = rentangPeriode("harian", "2024-10-23");
  const g = rentangGrafik(harian, harian);
  assert.equal(g.granularitas, "harian");
  assert.equal(
    daftarTanggal(g.sekarang.dari, g.sekarang.sampai).length,
    HARI_GRAFIK_HARIAN,
  );
  assert.equal(g.sekarang.sampai, "2024-10-23");
  assert.equal(g.lalu.sampai, "2024-10-09");

  const tahunan = rentangPeriode("tahunan", "2024-10-23");
  const gt = rentangGrafik(tahunan, rentangPeriode("tahunan", "2023-01-01"));
  assert.equal(gt.granularitas, "bulanan");
  const h = daftarTanggal("2024-01-01", "2024-03-31").map((tanggal) =>
    hari({ tanggal, gmv: 1 }),
  );
  const t = titikMetrik(h, "gmv", "bulanan");
  assert.deepEqual(
    t.map((x) => [x.label, x.nilai]),
    [
      ["Jan 2024", 31],
      ["Feb 2024", 29],
      ["Mar 2024", 31],
    ],
  );

  // ≤ 62 hari tetap per hari.
  const bulanan = rentangPeriode("bulanan", "2024-10-23");
  assert.equal(rentangGrafik(bulanan, bulanan).granularitas, "harian");
});

test("garis periode lalu disejajarkan per titik; tanpa laporan sama sekali tidak digambar (E1)", () => {
  const kini = [
    { label: "1 Okt", nilai: 1 },
    { label: "2 Okt", nilai: 2 },
    { label: "3 Okt", nilai: 3 },
  ];
  assert.equal(
    sejajarkan(kini, [{ label: "1 Sep", nilai: 0, kosong: true }]),
    null,
  );
  const s = sejajarkan(kini, [
    { label: "1 Sep", nilai: 5 },
    { label: "2 Sep", nilai: 0, kosong: true },
  ]);
  assert.deepEqual(
    s?.map((t) => [t.label, t.kosong ?? false, t.nilai]),
    [
      ["1 Okt", false, 5],
      ["2 Okt", true, 0],
      ["3 Okt", true, 0],
    ],
  );
});

test("AC4: total ringkasan = jumlah GMV laporan dalam periode", () => {
  const h = [
    hari({ tanggal: "2024-09-30", gmv: 999 }),
    hari({ tanggal: "2024-10-01", gmv: 100, upload: 3, komisi: 10 }),
    hari({ tanggal: "2024-10-02", lapor: false }),
    hari({ tanggal: "2024-10-03", gmv: 50, upload: 1, komisi: 5 }),
  ];
  const r = ringkasAkun(
    dalamRentang(h, { dari: "2024-10-01", sampai: "2024-10-31" }),
  );
  assert.deepEqual(r, {
    gmv: 150,
    upload: 4,
    komisi: 15,
    hariLapor: 2,
    hariKerja: 3,
  });
});

test("sorotan: GMV tertinggi, rata-rata per hari lapor, hari kerja di bawah minimum", () => {
  const s = sorotanAkun(
    [
      hari({ tanggal: "2024-10-01", gmv: 100, upload: 5 }),
      hari({ tanggal: "2024-10-02", gmv: 300, upload: 2 }),
      hari({ tanggal: "2024-10-03", lapor: false, hariKerja: true }),
      hari({ tanggal: "2024-10-04", lapor: false, hariKerja: false }),
    ],
    3,
  );
  assert.deepEqual(s.tertinggi, { tanggal: "2024-10-02", gmv: 300 });
  assert.equal(s.rataPerHariLapor, 200);
  // 2 Okt (2 < 3) dan 3 Okt (tidak lapor); 4 Okt libur tidak dihitung.
  assert.equal(s.hariDiBawahMinimum, 2);
  assert.equal(sorotanAkun([], null).tertinggi, null);
  assert.equal(sorotanAkun([], null).hariDiBawahMinimum, null);
});

test("tabel harian: terbaru di atas, status per hari, komisi tidak muncul bila tidak boleh", () => {
  const b = barisHarian(
    [
      hari({ tanggal: "2024-10-01", gmv: 100, upload: 5 }),
      hari({ tanggal: "2024-10-03", lapor: false, hariKerja: true }),
      hari({ tanggal: "2024-10-02", gmv: 300, upload: 2 }),
      hari({ tanggal: "2024-10-04", lapor: false, hariKerja: false }),
    ],
    3,
  );
  assert.deepEqual(
    b.map((x) => [x.tanggal, x.status]),
    [
      ["2024-10-04", "libur"],
      ["2024-10-03", "tidak-lapor"],
      ["2024-10-02", "kurang"],
      ["2024-10-01", "memenuhi"],
    ],
  );
  // Akun tanpa level: hari yang dilaporkan hanya "Terlapor".
  assert.equal(
    barisHarian([hari({ tanggal: "2024-10-01" })], null)[0].status,
    "terlapor",
  );
  // Tanpa izin komisi, `susunHari` menerima null → tidak ada angka komisi.
  const tanpa = susunHari(
    ["2024-10-01"],
    new Map([["2024-10-01", { gmv: 1, upload: 1 }]]),
    null,
    new Set(),
  );
  assert.ok(barisHarian(tanpa, 1).every((x) => x.komisi === null));
});
