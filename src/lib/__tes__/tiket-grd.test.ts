import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  KETERANGAN_ALASAN,
  PESAN_TENGGAT_GRD,
  bolehUbahTenggatTiketGrd,
  idKartuTiket,
  keteranganTonggakBertiket,
  susunLaporanTiketGrd,
  tautanBukaTiket,
  type AlasanDilewati,
  type LaporanTiketGrd,
} from "@/lib/tiket-grd";

/** Bentuk laporan `buat_tiket_grd` (0201), seperti keluaran database. */
const laporan = (tambahan: Partial<LaporanTiketGrd> = {}): LaporanTiketGrd => ({
  periode: "2026-10-01",
  uji: true,
  terkunci: false,
  rencana_harian: 18,
  tonggak_diperiksa: 6,
  dibuat: 3,
  sudah_ada: 1,
  sudah_lewat_tenggat: 2,
  alasan_dilewati: { sudah_punya_tiket: 1, tanpa_tenggat: 1, tanpa_pic: 1 },
  per_penerima: [
    { penerima: "Rifal", pemberi: "Dewi Lestari", jumlah: 2 },
    { penerima: "Alma", pemberi: "Farhan Pratama", jumlah: 1 },
  ],
  tiket: [
    {
      kode: "1.1.1.1",
      tonggak: "Host LIVE sudah didapat",
      judul: "1.1.1.1 · Host LIVE sudah didapat",
      penerima: "Rifal",
      pemberi: "Dewi Lestari",
      tenggat: "2026-10-03T17:00",
      status: "todo",
      catatan: null,
    },
  ],
  dilewati: [
    { kode: "S.2.2.9", tonggak: "MRM H-1", alasan: "tanpa_tenggat" },
    { kode: "1.4.1.1", tonggak: "Santri aktif", alasan: "tanpa_pic" },
  ],
  perlu_diperiksa: [
    {
      kode: "1.4.1.2",
      tonggak: "Host siap",
      penerima: "Siti",
      catatan: "Kolom SIAPA tidak tampak pada nama PIC",
    },
  ],
  ...tambahan,
});

test("laporan uji coba menyebut berapa tiket, untuk siapa, dari siapa", () => {
  const teks = susunLaporanTiketGrd(laporan()).join("\n");
  assert.match(teks, /Oktober 2026/);
  assert.match(teks, /UJI COBA, belum ada yang disimpan/);
  assert.match(teks, /6 tonggak sekali\/pekanan diperiksa/);
  assert.match(teks, /3 tiket akan dibuat/);
  assert.match(teks, /2 di antaranya sudah lewat tenggat: tenggatnya tidak digeser/);
  assert.match(teks, /Rifal ← dari Dewi Lestari: 2 tiket/);
  assert.match(teks, /Alma ← dari Farhan Pratama: 1 tiket/);
});

test("rencana harian disebut tidak dibuatkan tiket (aturan 1)", () => {
  const teks = susunLaporanTiketGrd(laporan()).join("\n");
  assert.match(teks, /18 rencana harian tidak dibuatkan tiket/);
  // Tanpa rencana harian, barisnya tidak muncul.
  const tanpa = susunLaporanTiketGrd(laporan({ rencana_harian: 0 })).join("\n");
  assert.doesNotMatch(tanpa, /rencana harian/);
});

test("tonggak yang dilewati disebut beserta alasannya (aturan 5)", () => {
  const teks = susunLaporanTiketGrd(laporan()).join("\n");
  assert.match(teks, /Dilewati \(2 tonggak\)/);
  assert.match(teks, /S\.2\.2\.9 "MRM H-1" — tenggatnya belum ditetapkan/);
  assert.match(teks, /1\.4\.1\.1 "Santri aktif" — tidak ada PIC terdaftar/);
  // "Sudah bertiket" bukan alasan dilewati; dihitung terpisah.
  assert.match(teks, /1 sudah bertiket · 2 dilewati/);
});

test("catatan 'perlu diperiksa' ikut dicetak", () => {
  const teks = susunLaporanTiketGrd(laporan()).join("\n");
  assert.match(teks, /Perlu diperiksa \(1 tonggak\)/);
  assert.match(teks, /1\.4\.1\.2 \(Siti\): Kolom SIAPA tidak tampak/);
});

test("baris kembar digabung supaya yang penting tidak tenggelam", () => {
  const empat = (kode: string) =>
    ["Sen, 5", "Sen, 12", "Sen, 19", "Sen, 26"].map((t) => ({
      kode,
      tonggak: t,
      penerima: "Alma",
      catatan: "Kolom SIAPA tidak tampak pada nama PIC",
    }));
  const teks = susunLaporanTiketGrd(
    laporan({
      dilewati: [
        ...["Sab, 3", "Sab, 10", "Sab, 17"].map((t) => ({
          kode: "1.1.4.6",
          tonggak: t,
          alasan: "tanpa_pic" as const,
        })),
        { kode: "S.2.2.1", tonggak: "MRM H-1", alasan: "tanpa_tenggat" },
      ],
      perlu_diperiksa: [...empat("S.2.2.1"), ...empat("S.2.2.2")],
    }),
  ).join("\n");
  // Tiga tonggak sama-sama tanpa PIC → satu baris.
  assert.match(teks, /Dilewati \(4 tonggak\)/);
  assert.match(teks, /1\.1\.4\.6 \(3 tonggak\) — tidak ada PIC terdaftar/);
  assert.equal((teks.match(/1\.1\.4\.6/g) ?? []).length, 1);
  // Delapan catatan kembar → dua baris, masing-masing menyebut jumlahnya.
  assert.match(teks, /Perlu diperiksa \(8 tonggak\)/);
  assert.match(teks, /S\.2\.2\.1 \(Alma · 4 tonggak\): Kolom SIAPA/);
  assert.match(teks, /S\.2\.2\.2 \(Alma · 4 tonggak\): Kolom SIAPA/);
  assert.equal((teks.match(/Kolom SIAPA/g) ?? []).length, 2);
});

test("bulan terkunci dijelaskan: tidak ada yang dibuat", () => {
  const teks = susunLaporanTiketGrd(
    laporan({
      terkunci: true,
      dibuat: 0,
      per_penerima: [],
      alasan_dilewati: { bulan_terkunci: 6 },
      sudah_ada: 0,
      dilewati: [
        { kode: "1.1.1.1", tonggak: "Host", alasan: "bulan_terkunci" },
      ],
    }),
  ).join("\n");
  assert.match(teks, /KPI bulan ini sudah dikunci/);
  assert.match(teks, /KPI bulan itu sudah dikunci/);
  assert.doesNotMatch(teks, /Untuk siapa, dari siapa/);
});

test("hasil sungguhan tidak berlabel uji coba; daftar rinci hanya bila diminta", () => {
  const nyata = laporan({ uji: false });
  const ringkas = susunLaporanTiketGrd(nyata).join("\n");
  assert.doesNotMatch(ringkas, /UJI COBA/);
  assert.match(ringkas, /3 tiket dibuat/);
  assert.doesNotMatch(ringkas, /Daftar tiket/);

  const rinci = susunLaporanTiketGrd(nyata, { rinci: true }).join("\n");
  assert.match(rinci, /Daftar tiket \(1\)/);
  assert.match(
    rinci,
    /1\.1\.1\.1 · Host LIVE sudah didapat · Rifal ← Dewi Lestari · tenggat 2026-10-03 17:00 WIB/,
  );
});

test("uji coba impor: laporan tanpa daftar tiket tetap terbaca, label uji dari pemanggil", () => {
  // Hasil impor_grd membawa laporan tanpa `tiket` (terlalu panjang) dan
  // bertanda uji = false karena dibuat di dalam transaksi uji cobanya.
  const dariImpor = laporan({ uji: false });
  const { tiket, ...tanpaDaftar } = dariImpor;
  void tiket;
  const teks = susunLaporanTiketGrd(tanpaDaftar as LaporanTiketGrd, {
    uji: true,
    rinci: true,
  }).join("\n");
  assert.match(teks, /UJI COBA/);
  assert.match(teks, /3 tiket akan dibuat/);
});

test("setiap kode alasan punya keterangan berbahasa Indonesia", () => {
  const kode: AlasanDilewati[] = [
    "bulan_terkunci",
    "sudah_punya_tiket",
    "sudah_selesai",
    "tanpa_tenggat",
    "tanpa_pic",
    "penerima_nonaktif",
  ];
  for (const k of kode) {
    assert.ok(KETERANGAN_ALASAN[k].length > 5, k);
  }
  assert.deepEqual(Object.keys(KETERANGAN_ALASAN).sort(), [...kode].sort());
});

test("tautan 'Buka tiket' menuju kartunya di papan Tugas", () => {
  assert.equal(idKartuTiket("abc-123"), "tiket-abc-123");
  assert.equal(tautanBukaTiket("abc-123"), "/tugas#tiket-abc-123");
});

test("hanya CEO dan Manager yang boleh mengubah tenggat tiket GRD (aturan 8)", () => {
  assert.equal(bolehUbahTenggatTiketGrd("CEO"), true);
  assert.equal(bolehUbahTenggatTiketGrd("Manager"), true);
  for (const peran of ["Leader", "Co-Leader", "Staff", "Finance"]) {
    assert.equal(bolehUbahTenggatTiketGrd(peran), false, peran);
  }
  assert.match(PESAN_TENGGAT_GRD, /CEO atau Manager/);
});

test("chip tonggak ber-tiket menyebut status dan bahwa ia mengikuti tiket (aturan 7)", () => {
  assert.equal(
    keteranganTonggakBertiket("progress"),
    "Progress — mengikuti tiketnya",
  );
  assert.match(keteranganTonggakBertiket("selesai"), /^Selesai/);
  assert.match(keteranganTonggakBertiket("belum"), /^Belum/);
});
