import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  adaTarget,
  awalPekan,
  bandingkan,
  granularitasUntuk,
  kelompokkanPerUnit,
  metrikGmv,
  kelompokkanSeri,
  keTitikGrafik,
  keTitikTarget,
  labelTanggal,
  rekapUnit,
  periksaRentangKustom,
  potongSepadan,
  RENTANG_MAKS_HARI,
  ringkasGmv,
  selisihHari,
  seriDariAgregat,
  seriHarian,
  seriPerUnit,
  totalPerUnit,
  TAHUN_MULAI,
  tambahHari,
  type BarisGmv,
} from "@/lib/gmv";

const baris = (
  tanggal: string,
  gmv: number,
  target = 10,
  unitId: BarisGmv["unitId"] = "affiliator",
): BarisGmv => ({ tanggal, gmv, target, unitId, label: "@akun" });

test("laporan beberapa akun pada hari yang sama jadi satu titik", () => {
  const titik = seriHarian([
    baris("2024-10-01", 100),
    baris("2024-10-01", 50),
    baris("2024-10-02", 70),
  ]);
  assert.equal(titik.length, 2);
  assert.equal(titik[0].gmv, 150);
  assert.equal(titik[0].jumlahLaporan, 2);
  assert.equal(titik[1].gmv, 70);
});

test("titik selalu urut tanggal walau masukannya acak", () => {
  const titik = seriHarian([
    baris("2024-10-03", 3),
    baris("2024-10-01", 1),
    baris("2024-10-02", 2),
  ]);
  assert.deepEqual(
    titik.map((t) => t.tanggal),
    ["2024-10-01", "2024-10-02", "2024-10-03"],
  );
});

test("hari tanpa laporan tidak diisi nol", () => {
  // Nol berarti "jualan nihil"; yang sebenarnya terjadi adalah "tidak
  // ada yang melapor". Grafik tidak boleh mengarang bedanya.
  const titik = seriHarian([baris("2024-10-01", 5), baris("2024-10-05", 5)]);
  assert.equal(titik.length, 2);
  assert.deepEqual(
    titik.map((t) => t.tanggal),
    ["2024-10-01", "2024-10-05"],
  );
});

test("rata-rata dibagi hari terlapor, bukan panjang rentang", () => {
  const ringkas = ringkasGmv(
    seriHarian([baris("2024-10-01", 100), baris("2024-10-10", 200)]),
  );
  assert.equal(ringkas.hariTerlapor, 2);
  assert.equal(ringkas.rataRata, 150);
  assert.equal(ringkas.total, 300);
});

test("tertinggi dan terendah menyebut harinya", () => {
  const ringkas = ringkasGmv(
    seriHarian([
      baris("2024-10-01", 100),
      baris("2024-10-02", 300),
      baris("2024-10-03", 50),
    ]),
  );
  assert.equal(ringkas.tertinggi?.tanggal, "2024-10-02");
  assert.equal(ringkas.terendah?.tanggal, "2024-10-03");
});

test("periode kosong tidak melempar, hanya nol", () => {
  const ringkas = ringkasGmv([]);
  assert.equal(ringkas.total, 0);
  assert.equal(ringkas.rataRata, 0);
  assert.equal(ringkas.tertinggi, null);
  assert.equal(ringkas.capaian, 0);
});

test("capaian dihitung terhadap akumulasi target hari terlapor", () => {
  const ringkas = ringkasGmv(
    seriHarian([baris("2024-10-01", 8, 10), baris("2024-10-02", 12, 10)]),
  );
  assert.equal(ringkas.totalTarget, 20);
  assert.equal(ringkas.capaian, 100);
});

test("naik dari nol tidak dilaporkan sebagai kenaikan persen", () => {
  // Naik dari periode tanpa laporan bukan prestasi; ia tanda tidak ada
  // yang bisa dibandingkan.
  const b = bandingkan(500, 0);
  assert.equal(b.tanpaPembanding, true);
  assert.equal(b.persen, 0);
  assert.equal(b.arah, "naik");
});

test("perbandingan biasa menghitung arah, selisih, dan persen", () => {
  const naik = bandingkan(120, 100);
  assert.equal(naik.arah, "naik");
  assert.equal(naik.selisih, 20);
  assert.equal(naik.persen, 20);

  const turun = bandingkan(80, 100);
  assert.equal(turun.arah, "turun");
  assert.equal(turun.selisih, -20);
  assert.equal(turun.persen, -20);

  assert.equal(bandingkan(100, 100).arah, "tetap");
});

test("label tanggal ringkas dan bebas zona waktu", () => {
  assert.equal(labelTanggal("2024-10-24"), "24 Okt");
  assert.equal(labelTanggal("2024-01-01"), "1 Jan");
  assert.equal(labelTanggal("2024-12-31"), "31 Des");
});

test("titik grafik hanya membawa label dan nilai", () => {
  const titik = keTitikGrafik(seriHarian([baris("2024-10-01", 42)]));
  assert.deepEqual(titik, [{ label: "1 Okt", nilai: 42 }]);
});

test("rekap unit dijumlahkan dan diurutkan dari terbesar", () => {
  const rekap = rekapUnit([
    baris("2024-10-01", 10, 0, "mcn"),
    baris("2024-10-01", 30, 0, "affiliator"),
    baris("2024-10-02", 15, 0, "mcn"),
    baris("2024-10-02", 5, 0, "tap"),
  ]);
  assert.deepEqual(rekap, [
    { unitId: "affiliator", gmv: 30 },
    { unitId: "mcn", gmv: 25 },
    { unitId: "tap", gmv: 5 },
  ]);
});

test("laporan tanpa unit tetap terhitung, tidak hilang", () => {
  const rekap = rekapUnit([baris("2024-10-01", 7, 0, null)]);
  assert.deepEqual(rekap, [{ unitId: null, gmv: 7 }]);
});

test("garis target sejajar dengan garis GMV, titik per titik", () => {
  const titik = seriHarian([
    baris("2024-10-01", 8, 10),
    baris("2024-10-02", 12, 10),
  ]);
  const gmv = keTitikGrafik(titik);
  const target = keTitikTarget(titik);
  assert.equal(gmv.length, target.length);
  assert.deepEqual(
    gmv.map((t) => t.label),
    target.map((t) => t.label),
  );
  assert.deepEqual(
    target.map((t) => t.nilai),
    [10, 10],
  );
});

test("target beberapa akun pada hari yang sama ikut dijumlahkan", () => {
  const titik = seriHarian([
    baris("2024-10-01", 5, 10),
    baris("2024-10-01", 5, 15),
  ]);
  assert.deepEqual(keTitikTarget(titik), [{ label: "1 Okt", nilai: 25 }]);
});

test("adaTarget membedakan periode bertarget dari yang tidak", () => {
  assert.equal(adaTarget(seriHarian([baris("2024-10-01", 5, 10)])), true);
  assert.equal(adaTarget(seriHarian([baris("2024-10-01", 5, 0)])), false);
  assert.equal(adaTarget([]), false);
});

test("tiap hari membawa laporan penyusunnya, terbesar lebih dulu", () => {
  const titik = seriHarian([
    { tanggal: "2024-10-01", gmv: 10, target: 0, unitId: "mcn", label: "MCN" },
    {
      tanggal: "2024-10-01",
      gmv: 30,
      target: 0,
      unitId: "affiliator",
      label: "@akun",
    },
  ]);
  assert.equal(titik[0].jumlahLaporan, 2);
  assert.deepEqual(
    titik[0].penyusun.map((p) => [p.label, p.gmv]),
    [
      ["@akun", 30],
      ["MCN", 10],
    ],
  );
});

test("jumlah penyusun selalu sama dengan jumlahLaporan", () => {
  const titik = seriHarian([
    baris("2024-10-01", 1),
    baris("2024-10-01", 2),
    baris("2024-10-02", 3),
  ]);
  for (const t of titik) {
    assert.equal(t.penyusun.length, t.jumlahLaporan, t.tanggal);
  }
});

test("total sebuah hari sama dengan jumlah penyusunnya", () => {
  const titik = seriHarian([
    baris("2024-10-01", 11),
    baris("2024-10-01", 22),
    baris("2024-10-01", 33),
  ]);
  assert.equal(
    titik[0].penyusun.reduce((a, p) => a + p.gmv, 0),
    titik[0].gmv,
  );
});

test("seri dari agregat punya bentuk yang sama, tanpa penyusun", () => {
  const titik = seriDariAgregat([
    { tanggal: "2024-10-02", gmv: 20, jumlahLaporan: 2 },
    { tanggal: "2024-10-01", gmv: 10, jumlahLaporan: 1 },
  ]);
  assert.deepEqual(
    titik.map((t) => t.tanggal),
    ["2024-10-01", "2024-10-02"],
  );
  assert.equal(titik[0].label, "1 Okt");
  assert.equal(titik[1].jumlahLaporan, 2);
  // Rincian per laporan memang tidak ditarik; daftar kosong lebih jujur
  // daripada daftar yang seolah-olah lengkap.
  assert.deepEqual(titik[0].penyusun, []);
});

test("ringkasan dari agregat sama dengan ringkasan dari laporan mentah", () => {
  const mentah = seriHarian([
    baris("2024-10-01", 10),
    baris("2024-10-01", 5),
    baris("2024-10-02", 20),
  ]);
  const agregat = seriDariAgregat([
    { tanggal: "2024-10-01", gmv: 15, jumlahLaporan: 2 },
    { tanggal: "2024-10-02", gmv: 20, jumlahLaporan: 1 },
  ]);
  const a = ringkasGmv(mentah);
  const b = ringkasGmv(agregat);
  assert.equal(a.total, b.total);
  assert.equal(a.rataRata, b.rataRata);
  assert.equal(a.hariTerlapor, b.hariTerlapor);
  assert.equal(a.tertinggi?.tanggal, b.tertinggi?.tanggal);
});

test("kekasaran titik mengikuti panjang rentang", () => {
  assert.equal(granularitasUntuk(1), "harian");
  assert.equal(granularitasUntuk(31), "harian");
  assert.equal(granularitasUntuk(62), "harian");
  assert.equal(granularitasUntuk(63), "mingguan");
  assert.equal(granularitasUntuk(366), "mingguan");
  assert.equal(granularitasUntuk(367), "bulanan");
});

test("jumlah titik tetap bisa dibaca mata untuk rentang apa pun", () => {
  // Setahun penuh, tiap hari ada laporan.
  const harian = [];
  for (let i = 0; i < 366; i++) {
    const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
    harian.push({ tanggal: d, gmv: 10, jumlahLaporan: 1 });
  }
  const titik = seriDariAgregat(harian);
  const dikelompokkan = kelompokkanSeri(titik, granularitasUntuk(366));
  assert.ok(
    dikelompokkan.length >= 10 && dikelompokkan.length <= 60,
    `jumlah titik ${dikelompokkan.length} di luar kisaran yang terbaca`,
  );
});

test("pengelompokan tidak mengubah total", () => {
  const titik = seriDariAgregat([
    { tanggal: "2024-10-01", gmv: 10, jumlahLaporan: 1 },
    { tanggal: "2024-10-02", gmv: 20, jumlahLaporan: 2 },
    { tanggal: "2024-11-05", gmv: 30, jumlahLaporan: 3 },
  ]);
  for (const g of ["harian", "mingguan", "bulanan"] as const) {
    const hasil = kelompokkanSeri(titik, g);
    assert.equal(
      hasil.reduce((a, t) => a + t.gmv, 0),
      60,
      `total berubah pada granularitas ${g}`,
    );
    assert.equal(
      hasil.reduce((a, t) => a + t.jumlahLaporan, 0),
      6,
      `jumlah laporan berubah pada granularitas ${g}`,
    );
  }
});

test("pengelompokan bulanan memberi satu titik per bulan", () => {
  const titik = seriDariAgregat([
    { tanggal: "2024-10-01", gmv: 10, jumlahLaporan: 1 },
    { tanggal: "2024-10-31", gmv: 20, jumlahLaporan: 1 },
    { tanggal: "2024-11-05", gmv: 30, jumlahLaporan: 1 },
  ]);
  const hasil = kelompokkanSeri(titik, "bulanan");
  assert.deepEqual(
    hasil.map((t) => [t.label, t.gmv]),
    [
      ["Oktober 2024", 30],
      ["November 2024", 30],
    ],
  );
});

test("pekan dimulai Senin, sejalan filter periode mingguan", () => {
  // 2024-10-24 Kamis; Seninnya 2024-10-21.
  assert.equal(awalPekan("2024-10-24"), "2024-10-21");
  assert.equal(awalPekan("2024-10-21"), "2024-10-21");
  // Minggu masih ikut pekan sebelumnya.
  assert.equal(awalPekan("2024-10-27"), "2024-10-21");
  assert.equal(awalPekan("2024-10-28"), "2024-10-28");
});

test("pengelompokan mingguan menaruh Minggu pada pekan yang sama dengan Seninnya", () => {
  const titik = seriDariAgregat([
    { tanggal: "2024-10-21", gmv: 1, jumlahLaporan: 1 },
    { tanggal: "2024-10-27", gmv: 1, jumlahLaporan: 1 },
    { tanggal: "2024-10-28", gmv: 1, jumlahLaporan: 1 },
  ]);
  const hasil = kelompokkanSeri(titik, "mingguan");
  assert.equal(hasil.length, 2);
  assert.equal(hasil[0].gmv, 2);
  assert.equal(hasil[1].gmv, 1);
});

test("pembanding dipotong sepanjang hari yang sudah berjalan", () => {
  // Bulan ini 1–31 Okt, hari ini 8 Okt → baru 8 hari berjalan.
  const hasil = potongSepadan(
    { dari: "2024-09-01", sampai: "2024-09-30" },
    { dari: "2024-10-01", sampai: "2024-10-31" },
    "2024-10-08",
  );
  assert.deepEqual(hasil, {
    dari: "2024-09-01",
    sampai: "2024-09-08",
    dipotong: true,
  });
});

test("periode yang sudah lewat penuh tidak dipotong", () => {
  const hasil = potongSepadan(
    { dari: "2024-08-01", sampai: "2024-08-31" },
    { dari: "2024-09-01", sampai: "2024-09-30" },
    "2024-10-24",
  );
  assert.equal(hasil.dipotong, false);
  assert.equal(hasil.sampai, "2024-08-31");
});

test("periode yang belum mulai tidak memotong pembandingnya", () => {
  const hasil = potongSepadan(
    { dari: "2024-10-01", sampai: "2024-10-31" },
    { dari: "2024-11-01", sampai: "2024-11-30" },
    "2024-10-24",
  );
  assert.equal(hasil.dipotong, false);
});

test("pemotongan tidak pernah melewati akhir pembandingnya", () => {
  // Februari lebih pendek dari Maret; hari ke-30 Maret tidak ada di Feb.
  const hasil = potongSepadan(
    { dari: "2024-02-01", sampai: "2024-02-29" },
    { dari: "2024-03-01", sampai: "2024-03-31" },
    "2024-03-31",
  );
  assert.equal(hasil.sampai, "2024-02-29");
  assert.equal(hasil.dipotong, false);
});

test("selisih dan penambahan hari aman melewati batas bulan dan kabisat", () => {
  assert.equal(selisihHari("2024-02-28", "2024-03-01"), 2);
  assert.equal(tambahHari("2024-02-28", 2), "2024-03-01");
  assert.equal(tambahHari("2024-12-31", 1), "2025-01-01");
  assert.equal(selisihHari("2024-10-01", "2024-10-01"), 0);
});

test("rentang kustom yang wajar diterima", () => {
  assert.deepEqual(periksaRentangKustom("2024-10-01", "2024-10-31"), {
    ok: true,
  });
  assert.deepEqual(periksaRentangKustom("2024-10-01", "2024-10-01"), {
    ok: true,
  });
});

test("tanggal terbalik ditolak di server, bukan ditukar diam-diam", () => {
  const hasil = periksaRentangKustom("2024-10-31", "2024-10-01");
  assert.equal(hasil.ok, false);
  assert.match(hasil.ok ? "" : hasil.pesan, /mendahului/i);
});

test("tanggal yang tidak ada di kalender ditolak", () => {
  for (const [a, b] of [
    ["2024-02-31", "2024-03-01"],
    ["2024-13-01", "2024-13-02"],
    ["2023-02-29", "2023-03-01"],
  ]) {
    const hasil = periksaRentangKustom(a, b);
    assert.equal(hasil.ok, false, `${a} seharusnya ditolak`);
  }
  // 2024 kabisat, jadi 29 Februari memang ada.
  assert.equal(periksaRentangKustom("2024-02-29", "2024-03-01").ok, true);
});

test("format yang bukan tanggal ditolak", () => {
  for (const [a, b] of [
    ["kemarin", "hari ini"],
    ["01-10-2024", "31-10-2024"],
    ["", ""],
  ]) {
    assert.equal(periksaRentangKustom(a, b).ok, false);
  }
});

test("rentang di luar akal sehat ditolak dengan alasan", () => {
  const panjang = periksaRentangKustom("2024-01-01", "2035-01-01");
  assert.equal(panjang.ok, false);
  assert.match(panjang.ok ? "" : panjang.pesan, /terlalu panjang/i);

  const purba = periksaRentangKustom("1999-01-01", "1999-12-31");
  assert.equal(purba.ok, false);
  assert.match(purba.ok ? "" : purba.pesan, new RegExp(String(TAHUN_MULAI)));
});

test("batas panjang tepat di ambang masih diterima", () => {
  const sampai = tambahHari("2024-01-01", RENTANG_MAKS_HARI - 1);
  assert.equal(periksaRentangKustom("2024-01-01", sampai).ok, true);
  const lewat = tambahHari("2024-01-01", RENTANG_MAKS_HARI);
  assert.equal(periksaRentangKustom("2024-01-01", lewat).ok, false);
});

const unitHarian = (
  tanggal: string,
  unitId: "affiliator" | "mcn" | "tap",
  gmv: number,
) => ({ tanggal, unitId, gmv });

test("tiap lini memakai sumbu tanggal yang sama dengan garis gabungan", () => {
  // Garis dengan jumlah titik berbeda akan tergambar sejajar padahal
  // tanggalnya bergeser — perbandingan yang tidak pernah terjadi.
  const titik = seriHarian([
    baris("2024-10-01", 10, 0, "affiliator"),
    baris("2024-10-02", 20, 0, "affiliator"),
    baris("2024-10-03", 30, 0, "mcn"),
  ]);
  const seri = seriPerUnit(titik, [
    unitHarian("2024-10-01", "affiliator", 10),
    unitHarian("2024-10-02", "affiliator", 20),
    unitHarian("2024-10-03", "mcn", 30),
  ]);

  assert.equal(seri.length, 2);
  for (const s of seri) {
    assert.equal(s.titik.length, titik.length, s.nama);
    assert.deepEqual(
      s.titik.map((t) => t.label),
      titik.map((t) => t.label),
      s.nama,
    );
  }
});

test("hari tanpa laporan digambar nol tapi tidak dihitung sebagai hari terlapor", () => {
  const titik = seriHarian([
    baris("2024-10-01", 10, 0, "affiliator"),
    baris("2024-10-02", 30, 0, "mcn"),
  ]);
  const seri = seriPerUnit(titik, [
    unitHarian("2024-10-01", "affiliator", 10),
    unitHarian("2024-10-02", "mcn", 30),
  ]);

  const aff = seri.find((s) => s.unitId === "affiliator")!;
  // Garis harus utuh untuk bisa dibaca…
  assert.deepEqual(
    aff.titik.map((t) => t.nilai),
    [10, 0],
  );
  // …tapi angkanya dihitung dari hari yang benar-benar melapor.
  assert.equal(aff.hariTerlapor, 1);
  assert.equal(aff.rataRata, 10);
  assert.equal(aff.total, 10);
});

test("urutan lini tetap, tidak mengikuti besarnya", () => {
  // Warna dan legenda tidak boleh berpindah antar periode.
  const titik = seriHarian([baris("2024-10-01", 1, 0, "tap")]);
  const seri = seriPerUnit(titik, [
    unitHarian("2024-10-01", "tap", 100),
    unitHarian("2024-10-01", "affiliator", 1),
    unitHarian("2024-10-01", "mcn", 50),
  ]);
  assert.deepEqual(
    seri.map((s) => s.unitId),
    ["affiliator", "mcn", "tap"],
  );
});

test("lini tanpa satu pun laporan tidak ikut digambar", () => {
  const titik = seriHarian([baris("2024-10-01", 10, 0, "affiliator")]);
  const seri = seriPerUnit(titik, [unitHarian("2024-10-01", "affiliator", 10)]);
  assert.deepEqual(
    seri.map((s) => s.unitId),
    ["affiliator"],
  );
});

test("jumlah seluruh lini sama dengan total gabungannya", () => {
  const titik = seriHarian([
    baris("2024-10-01", 10, 0, "affiliator"),
    baris("2024-10-01", 5, 0, "mcn"),
    baris("2024-10-02", 7, 0, "tap"),
  ]);
  const seri = seriPerUnit(titik, [
    unitHarian("2024-10-01", "affiliator", 10),
    unitHarian("2024-10-01", "mcn", 5),
    unitHarian("2024-10-02", "tap", 7),
  ]);
  assert.equal(
    seri.reduce((a, s) => a + s.total, 0),
    ringkasGmv(titik).total,
  );
});

test("pengelompokan per lini mengikuti kekasaran grafiknya", () => {
  const harian = [
    unitHarian("2024-10-21", "mcn", 10),
    unitHarian("2024-10-22", "mcn", 20),
    unitHarian("2024-10-28", "mcn", 5),
  ];
  const mingguan = kelompokkanPerUnit(harian, "mingguan");
  assert.equal(mingguan.length, 2);
  assert.deepEqual(
    mingguan.map((b) => [b.tanggal, b.gmv]).sort(),
    [
      ["2024-10-21", 30],
      ["2024-10-28", 5],
    ].sort(),
  );
  // Harian tidak diubah sama sekali.
  assert.equal(kelompokkanPerUnit(harian, "harian").length, 3);
});

test("pengelompokan tidak mencampur lini yang berbeda", () => {
  const hasil = kelompokkanPerUnit(
    [unitHarian("2024-10-21", "mcn", 10), unitHarian("2024-10-22", "tap", 20)],
    "mingguan",
  );
  assert.equal(hasil.length, 2);
  assert.deepEqual(hasil.map((b) => b.unitId).sort(), ["mcn", "tap"]);
});

/* ------------------------------------------------------------------ *
 * Metrik yang bisa dipilih
 * ------------------------------------------------------------------ */

const titikContoh = [
  {
    tanggal: "2024-10-01",
    label: "1 Okt",
    gmv: 30_000_000,
    target: 37_500_000,
    jumlahLaporan: 8,
    penyusun: [],
  },
  {
    tanggal: "2024-10-02",
    label: "2 Okt",
    gmv: 40_000_000,
    target: 37_500_000,
    jumlahLaporan: 7,
    penyusun: [],
  },
];

const liniContoh = [
  {
    unitId: "mcn" as const,
    nama: "MCN",
    titik: [
      { label: "1 Okt", nilai: 12_000_000 },
      { label: "2 Okt", nilai: 14_000_000 },
    ],
    total: 26_000_000,
    rataRata: 13_000_000,
    hariTerlapor: 2,
    tertinggi: { label: "2 Okt", nilai: 14_000_000 },
    terendah: { label: "1 Okt", nilai: 12_000_000 },
  },
];

test("totalPerUnit menjumlahkan tiap lini", () => {
  const total = totalPerUnit([
    { tanggal: "2024-10-01", unitId: "mcn", gmv: 10 },
    { tanggal: "2024-10-02", unitId: "mcn", gmv: 5 },
    { tanggal: "2024-10-01", unitId: "tap", gmv: 3 },
  ]);
  assert.deepEqual(total, { mcn: 15, tap: 3 });
});

test("metrikGmv menyusun angka periode, bukan angka titik terakhir", () => {
  const metrik = metrikGmv({
    titik: titikContoh,
    seriLini: liniContoh,
    sebelum: { gmv: 50_000_000, jumlahLaporan: 10 },
    sebelumLini: { mcn: 20_000_000 },
  });
  const per = Object.fromEntries(metrik.map((m) => [m.kunci, m]));

  assert.equal(per.gmv.nilai, 70_000_000);
  assert.equal(per.gmv.sebelumnya, 50_000_000);
  assert.equal(per.laporan.nilai, 15);
  assert.equal(per.laporan.satuan, "angka");
  assert.equal(per.mcn.nilai, 26_000_000);
  assert.equal(per.mcn.sebelumnya, 20_000_000);
  assert.equal(per.mcn.kelompok, "lini");
});

test("metrikGmv tidak menjanjikan perbandingan target", () => {
  // Sistem tidak menyimpan target per tanggal; "target periode lalu"
  // hanyalah target hari ini dikali jumlah harinya — angka yang
  // kelihatan seperti perbandingan padahal bukan.
  const target = metrikGmv({
    titik: titikContoh,
    seriLini: [],
    sebelum: { gmv: 0, jumlahLaporan: 0 },
    sebelumLini: {},
  }).find((m) => m.kunci === "target");

  assert.ok(target);
  assert.equal(target.nilai, 75_000_000);
  assert.equal(target.sebelumnya, null);
  assert.ok(target.catatan);
  assert.equal(target.putus, true);
});

test("metrikGmv melewatkan target bila periode itu memang tak punya", () => {
  const metrik = metrikGmv({
    titik: titikContoh.map((t) => ({ ...t, target: 0 })),
    seriLini: [],
    sebelum: { gmv: 0, jumlahLaporan: 0 },
    sebelumLini: {},
  });
  assert.equal(
    metrik.some((m) => m.kunci === "target"),
    false,
  );
});

test("metrikGmv memberi tiap metrik warna yang berbeda", () => {
  // Dua garis berwarna sama pada satu bingkai tidak bisa dibedakan.
  const metrik = metrikGmv({
    titik: titikContoh,
    seriLini: liniContoh,
    sebelum: { gmv: 0, jumlahLaporan: 0 },
    sebelumLini: {},
  });
  const warna = metrik.map((m) => m.warna);
  assert.equal(new Set(warna).size, warna.length, warna.join(", "));
});
