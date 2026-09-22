import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  akumulasiPenyusutan,
  asetTersaring,
  bacaSaringanAset,
  bacaSaringanLogAset,
  bandingkanJejak,
  bulanPenuh,
  jadwalPenyusutan,
  logAsetTersaring,
  kodeAsetBerikutnya,
  nilaiAsetPer,
  nilaiBuku,
  nilaiHangus,
  penyusutanPerBulan,
  periksaAset,
  periksaPerpindahanAset,
  perpindahanAsetSah,
  ringkasAset,
  saringAset,
  saringLogAset,
  sisaMasaManfaat,
  tujuanPerpindahan,
  type Aset,
  type BarisLogAset,
  type MasukanAset,
  type MasukanPerpindahanAset,
  type StatusAset,
} from "../aset.ts";

const a = (b: Partial<Aset>): Aset => ({
  id: b.id ?? Math.random().toString(36),
  kode: b.kode ?? "AST-0001",
  nama: b.nama ?? "Laptop editor",
  kategori: b.kategori ?? "Elektronik",
  unitKode: b.unitKode ?? null,
  unitNama: b.unitNama ?? "Perusahaan",
  tanggal: b.tanggal ?? "2024-01-15",
  nilaiPerolehan: b.nilaiPerolehan ?? 12_000_000,
  masaManfaat: b.masaManfaat ?? 24,
  residu: b.residu ?? 0,
  status: b.status ?? "dipakai",
  pemegangId: b.pemegangId ?? null,
  pemegangNama: b.pemegangNama ?? null,
  lokasi: b.lokasi ?? "Kantor",
  berakhir: b.berakhir ?? null,
  transaksiId: b.transaksiId ?? null,
  catatan: b.catatan ?? "",
});

test("bulan penuh hanya dihitung saat tanggalnya genap", () => {
  assert.equal(bulanPenuh("2024-01-15", "2024-02-14"), 0);
  assert.equal(bulanPenuh("2024-01-15", "2024-02-15"), 1);
  assert.equal(bulanPenuh("2024-01-15", "2025-01-15"), 12);
  // Tanggal sebelum perolehan tidak menghasilkan bulan negatif.
  assert.equal(bulanPenuh("2024-01-15", "2023-12-31"), 0);
});

test("penyusutan garis lurus memakai nilai perolehan dikurangi residu", () => {
  const laptop = a({
    nilaiPerolehan: 12_000_000,
    residu: 2_400_000,
    masaManfaat: 24,
  });
  assert.equal(penyusutanPerBulan(laptop), 400_000);
  assert.equal(akumulasiPenyusutan(laptop, "2024-07-15"), 2_400_000);
  assert.equal(nilaiBuku(laptop, "2024-07-15"), 9_600_000);
});

test("penyusutan berhenti di akhir masa manfaat, menyisakan residu", () => {
  const laptop = a({
    nilaiPerolehan: 12_000_000,
    residu: 2_400_000,
    masaManfaat: 24,
  });
  // Lewat dua kali masa manfaat: nilainya tetap residu, bukan minus.
  assert.equal(nilaiBuku(laptop, "2028-01-15"), 2_400_000);
  assert.equal(sisaMasaManfaat(laptop, "2028-01-15"), 0);
});

test("aset tanpa masa manfaat tidak disusutkan", () => {
  const tanah = a({ masaManfaat: 0, nilaiPerolehan: 500_000_000 });
  assert.equal(penyusutanPerBulan(tanah), 0);
  assert.equal(nilaiBuku(tanah, "2030-01-01"), 500_000_000);
});

test("aset yang dilepas atau hilang bernilai buku nol", () => {
  const dilepas = a({ status: "dilepas", berakhir: "2024-06-15" });
  const hilang = a({ status: "hilang", berakhir: "2024-06-15" });
  assert.equal(nilaiBuku(dilepas, "2024-10-24"), 0);
  assert.equal(nilaiBuku(hilang, "2024-10-24"), 0);
});

test("nilai hangus aset hilang dihitung saat ia hilang, bukan hari ini", () => {
  const hilang = a({
    status: "hilang",
    nilaiPerolehan: 12_000_000,
    residu: 0,
    masaManfaat: 24,
    berakhir: "2024-07-15",
  });
  // Enam bulan susut (6 × 500.000) saat dinyatakan hilang.
  assert.equal(nilaiHangus(hilang, "2024-10-24"), 9_000_000);
  // Aset yang masih ada tidak menghanguskan apa pun.
  assert.equal(nilaiHangus(a({}), "2024-10-24"), 0);
});

test("ringkasan hanya menghitung aset yang masih dimiliki", () => {
  const r = ringkasAset(
    [
      a({ kode: "AST-0001", nilaiPerolehan: 12_000_000, masaManfaat: 24 }),
      a({
        kode: "AST-0002",
        nilaiPerolehan: 6_000_000,
        masaManfaat: 12,
        status: "perbaikan",
      }),
      a({
        kode: "AST-0003",
        nilaiPerolehan: 9_000_000,
        status: "dilepas",
        berakhir: "2024-06-15",
      }),
    ],
    "2024-07-15",
  );

  assert.equal(r.total, 3);
  assert.equal(r.dimiliki, 2);
  assert.equal(r.nilaiPerolehan, 18_000_000);
  assert.equal(r.perluPerhatian, 1);
  assert.equal(r.nilaiBuku, r.nilaiPerolehan - r.akumulasiPenyusutan);
});

test("aset dipakai tanpa pemegang dihitung sebagai tanpa penanggung jawab", () => {
  const r = ringkasAset(
    [
      a({ kode: "AST-0001", pemegangNama: "Dewi Lestari" }),
      a({ kode: "AST-0002", pemegangNama: null }),
      // Cadangan di gudang memang tidak dipegang siapa pun.
      a({ kode: "AST-0003", status: "cadangan", pemegangNama: null }),
    ],
    "2024-10-24",
  );

  assert.equal(r.tanpaPemegang, 1);
});

test("susut bulan berjalan mengabaikan aset yang masa manfaatnya habis", () => {
  const r = ringkasAset(
    [
      a({ kode: "AST-0001", nilaiPerolehan: 12_000_000, masaManfaat: 24 }),
      a({ kode: "AST-0002", tanggal: "2020-01-15", masaManfaat: 12 }),
    ],
    "2024-07-15",
  );

  assert.equal(r.susutBulanIni, 500_000);
});

test("aset yang sudah dilepas tidak bisa hidup lagi", () => {
  assert.equal(perpindahanAsetSah("dipakai", "perbaikan"), true);
  assert.equal(perpindahanAsetSah("hilang", "dipakai"), true);
  assert.equal(perpindahanAsetSah("dilepas", "dipakai"), false);
});

test("saringan menolak nilai yang tidak dikenal", () => {
  const s = bacaSaringanAset({
    status: "entah",
    unit: ["TAP"],
    cari: "  laptop ",
  });
  assert.equal(s.status, "semua");
  assert.equal(s.unit, "TAP");
  assert.equal(s.cari, "laptop");
  assert.equal(asetTersaring(s), true);
  assert.equal(asetTersaring(bacaSaringanAset({})), false);
});

test("pencarian mencakup pemegang dan lokasi, bukan hanya kode", () => {
  const daftar = [
    a({
      kode: "AST-0001",
      nama: "Laptop editor",
      pemegangNama: "Fajar Ramadhan",
    }),
    a({ kode: "AST-0002", nama: "Kamera Sony", lokasi: "Studio MCN Lt. 2" }),
  ];

  assert.equal(
    saringAset(daftar, bacaSaringanAset({ cari: "fajar" })).length,
    1,
  );
  assert.equal(
    saringAset(daftar, bacaSaringanAset({ cari: "studio" })).length,
    1,
  );
  assert.equal(
    saringAset(daftar, bacaSaringanAset({ cari: "AST-000" })).length,
    2,
  );
});

test("kode aset berikutnya melanjutkan nomor tertinggi", () => {
  assert.equal(kodeAsetBerikutnya([]), "AST-0001");
  assert.equal(
    kodeAsetBerikutnya(["AST-0001", "AST-0012", "acak"]),
    "AST-0013",
  );
});

test("nilai per kelompok menjumlahkan dan mengurutkan dari nilai buku terbesar", () => {
  const baris = nilaiAsetPer(
    [
      a({
        kode: "AST-0001",
        kategori: "Elektronik",
        nilaiPerolehan: 12_000_000,
        masaManfaat: 24,
      }),
      a({
        kode: "AST-0002",
        kategori: "Elektronik",
        nilaiPerolehan: 6_000_000,
        masaManfaat: 24,
      }),
      a({
        kode: "AST-0003",
        kategori: "Perabot",
        nilaiPerolehan: 3_000_000,
        masaManfaat: 0,
      }),
      // Sudah dilepas: tidak boleh ikut dihitung sebagai milik perusahaan.
      a({
        kode: "AST-0004",
        kategori: "Perabot",
        nilaiPerolehan: 90_000_000,
        status: "dilepas",
      }),
    ],
    "2024-07-15",
    (x) => x.kategori,
  );

  assert.deepEqual(
    baris.map((b) => [b.label, b.jumlah]),
    [
      ["Elektronik", 2],
      ["Perabot", 1],
    ],
  );
  assert.equal(baris[0].nilaiPerolehan, 18_000_000);
  assert.equal(
    baris[0].nilaiBuku,
    baris[0].nilaiPerolehan - baris[0].akumulasiPenyusutan,
  );
  // Aset tanpa masa manfaat tetap penuh nilainya.
  assert.equal(baris[1].nilaiBuku, 3_000_000);
});

test("jadwal penyusutan berhenti tepat di nilai residu", () => {
  const laptop = a({
    tanggal: "2023-03-15",
    nilaiPerolehan: 32_500_000,
    residu: 5_000_000,
    masaManfaat: 48,
  });
  const jadwal = jadwalPenyusutan(laptop);

  // Maret–Desember 2023 lalu tiga tahun penuh, sisanya jatuh di 2027.
  assert.deepEqual(
    jadwal.map((b) => [b.tahun, b.bulan]),
    [
      [2023, 10],
      [2024, 12],
      [2025, 12],
      [2026, 12],
      [2027, 2],
    ],
  );

  assert.equal(jadwal.at(-1)?.nilaiAkhir, 5_000_000);
  assert.equal(
    jadwal.reduce((n, b) => n + b.beban, 0),
    32_500_000 - 5_000_000,
  );
  // Nilai awal tiap tahun menyambung nilai akhir tahun sebelumnya.
  for (let i = 1; i < jadwal.length; i += 1) {
    assert.equal(jadwal[i].nilaiAwal, jadwal[i - 1].nilaiAkhir);
  }
});

test("aset tanpa masa manfaat tidak punya jadwal penyusutan", () => {
  assert.deepEqual(jadwalPenyusutan(a({ masaManfaat: 0 })), []);
});

const pindah = (
  b: Partial<MasukanPerpindahanAset>,
): MasukanPerpindahanAset => ({
  asetId: b.asetId ?? "aset-1",
  ke: b.ke ?? "dipakai",
  pemegangId: b.pemegangId ?? null,
  lokasi: b.lokasi ?? "Kantor Lt. 1",
  catatan: b.catatan ?? "",
});

test("tujuan perpindahan selalu menyertakan pindah tangan di tempat", () => {
  assert.equal(tujuanPerpindahan("dipakai")[0], "dipakai");
  // Aset yang sudah dilepas tidak punya langkah lanjutan sama sekali.
  assert.deepEqual(tujuanPerpindahan("dilepas"), []);
});

test("aset yang sudah dilepas menolak semua perubahan", () => {
  const salah = periksaPerpindahanAset(pindah({ ke: "dipakai" }), {
    status: "dilepas",
    pemegangId: null,
  });
  assert.match(salah ?? "", /perolehan baru/);
});

test("perpindahan keadaan yang tidak mungkin ditolak dengan namanya", () => {
  const salah = periksaPerpindahanAset(pindah({ ke: "perbaikan" }), {
    status: "hilang",
    pemegangId: null,
  });
  assert.match(salah ?? "", /hilang/);
});

test("pindah tangan ke pemegang yang sama bukan perubahan", () => {
  const salah = periksaPerpindahanAset(
    pindah({ ke: "dipakai", pemegangId: "u-1" }),
    { status: "dipakai", pemegangId: "u-1" },
  );
  assert.match(salah ?? "", /Belum ada yang berubah/);

  assert.equal(
    periksaPerpindahanAset(pindah({ ke: "dipakai", pemegangId: "u-2" }), {
      status: "dipakai",
      pemegangId: "u-1",
    }),
    null,
  );
});

test("aset cadangan tidak boleh punya pemegang perorangan", () => {
  const salah = periksaPerpindahanAset(
    pindah({ ke: "cadangan", pemegangId: "u-2" }),
    { status: "dipakai", pemegangId: "u-1" },
  );
  assert.match(salah ?? "", /gudang/);
});

test("hilang dan dilepas wajib berketerangan", () => {
  for (const ke of ["hilang", "dilepas"] as StatusAset[]) {
    const kurang = periksaPerpindahanAset(pindah({ ke, catatan: "hilang" }), {
      status: "dipakai",
      pemegangId: "u-1",
    });
    assert.ok(kurang, `${ke} tanpa keterangan seharusnya ditolak`);

    assert.equal(
      periksaPerpindahanAset(
        pindah({ ke, catatan: "Tidak kembali setelah pemegangnya berhenti." }),
        { status: "dipakai", pemegangId: "u-1" },
      ),
      null,
    );
  }
});

test("lokasi kosong ditolak: itulah yang dicari orang berikutnya", () => {
  const salah = periksaPerpindahanAset(
    pindah({ ke: "perbaikan", lokasi: " " }),
    { status: "dipakai", pemegangId: "u-1" },
  );
  assert.match(salah ?? "", /lokasi/i);
});

const log = (b: Partial<BarisLogAset>): BarisLogAset => ({
  id: b.id ?? Math.random().toString(36),
  asetId: b.asetId ?? "aset-1",
  kode: b.kode ?? "AST-0001",
  namaAset: b.namaAset ?? "Laptop editor",
  unitNama: b.unitNama ?? "MCN",
  dari: b.dari ?? "dipakai",
  ke: b.ke ?? "perbaikan",
  pemegangNama: b.pemegangNama ?? "Yoga Saputra",
  olehNama: b.olehNama ?? "Dimas Maulana",
  lokasi: b.lokasi ?? "Servis resmi Bandung",
  catatan: b.catatan ?? "",
  pada: b.pada ?? "2024-10-09",
});

test("saringan log menolak status dan tanggal yang tidak berbentuk", () => {
  const s = bacaSaringanLogAset({
    status: "rusak",
    dari: "09-10-2024",
    sampai: "2024-10-24",
  });
  assert.equal(s.status, "semua");
  assert.equal(s.dari, "");
  assert.equal(s.sampai, "2024-10-24");
  assert.equal(logAsetTersaring(s), true);
  assert.equal(logAsetTersaring(bacaSaringanLogAset({})), false);
});

test("log disaring menurut keadaan tujuan, unit, dan rentang tanggal", () => {
  const daftar = [
    log({ id: "1", pada: "2024-10-09", ke: "perbaikan", unitNama: "TAP" }),
    log({ id: "2", pada: "2024-09-30", ke: "hilang", unitNama: "Affiliator" }),
    log({ id: "3", pada: "2023-11-06", ke: "dipakai", unitNama: "Affiliator" }),
  ];

  assert.deepEqual(
    saringLogAset(daftar, bacaSaringanLogAset({ status: "hilang" })).map(
      (b) => b.id,
    ),
    ["2"],
  );
  assert.deepEqual(
    saringLogAset(daftar, bacaSaringanLogAset({ unit: "Affiliator" })).map(
      (b) => b.id,
    ),
    ["2", "3"],
  );
  assert.deepEqual(
    saringLogAset(
      daftar,
      bacaSaringanLogAset({ dari: "2024-01-01", sampai: "2024-10-01" }),
    ).map((b) => b.id),
    ["2"],
  );
});

test("pencarian log menemukan lewat nama pemegang maupun pencatatnya", () => {
  const daftar = [
    log({ id: "1", pemegangNama: "Yoga Saputra", olehNama: "Dimas Maulana" }),
    log({ id: "2", pemegangNama: "Maya Safitri", olehNama: "Galih Prakoso" }),
  ];

  assert.deepEqual(
    saringLogAset(daftar, bacaSaringanLogAset({ cari: "maya" })).map(
      (b) => b.id,
    ),
    ["2"],
  );
  assert.deepEqual(
    saringLogAset(daftar, bacaSaringanLogAset({ cari: "dimas" })).map(
      (b) => b.id,
    ),
    ["1"],
  );
});

const isian = (b: Partial<MasukanAset> = {}): MasukanAset => ({
  kode: b.kode ?? "",
  nama: b.nama ?? "Laptop editor",
  kategori: b.kategori ?? "Elektronik",
  unitKode: b.unitKode ?? null,
  tanggal: b.tanggal ?? "2024-10-24",
  nilaiPerolehan: b.nilaiPerolehan ?? 12_000_000,
  masaManfaat: b.masaManfaat ?? 48,
  residu: b.residu ?? 0,
  lokasi: b.lokasi ?? "Kantor Lt. 1",
  catatan: b.catatan ?? "",
});

test("isian aset yang wajar diterima apa adanya", () => {
  assert.equal(periksaAset(isian()), null);
  // Kode kosong berarti minta dibangkitkan berurutan.
  assert.equal(periksaAset(isian({ kode: "" })), null);
});

test("kode yang tidak berbentuk AST-0000 ditolak", () => {
  assert.match(periksaAset(isian({ kode: "LAPTOP-1" })) ?? "", /AST-0001/);
});

test("residu tidak boleh melebihi harga belinya", () => {
  const salah = periksaAset(
    isian({ nilaiPerolehan: 5_000_000, residu: 9_000_000 }),
  );
  assert.match(salah ?? "", /residu/i);
});

test("masa manfaat dibatasi supaya nilai buku tidak mengambang", () => {
  assert.equal(periksaAset(isian({ masaManfaat: 0 })), null);
  assert.ok(periksaAset(isian({ masaManfaat: 700 })));
  assert.ok(periksaAset(isian({ masaManfaat: -1 })));
});

test("nama dan tanggal yang kosong ditolak", () => {
  assert.ok(periksaAset(isian({ nama: "PC" })));
  assert.ok(periksaAset(isian({ tanggal: "24-10-2024" })));
});

test("jejak hanya menyebut kolom yang benar-benar berubah", () => {
  const perubahan = bandingkanJejak(
    {
      kode: "AST-0004",
      nama: "PC editing Ryzen 9",
      nilai_perolehan: "27400000.00",
      masa_manfaat: 48,
      status: "dipakai",
      // Kolom ini berubah, tetapi sengaja tidak ikut ditampilkan:
      // perpindahan pemegang sudah punya riwayatnya sendiri.
      pemegang_id: "a",
    },
    {
      kode: "AST-0004",
      nama: "PC editing Ryzen 9",
      nilai_perolehan: "30000000.00",
      masa_manfaat: 72,
      status: "dipakai",
      pemegang_id: "b",
    },
  );

  assert.deepEqual(
    perubahan.map((p) => p.label),
    ["Nilai perolehan", "Masa manfaat (bulan)"],
  );
  assert.equal(perubahan[0].dari, 27_400_000);
  assert.equal(perubahan[0].ke, 30_000_000);
  assert.equal(perubahan[0].rupiah, true);
});

test("pencatatan pertama tampil sebagai nilai yang muncul dari kosong", () => {
  const perubahan = bandingkanJejak(null, {
    kode: "AST-0013",
    nama: "Kamera cadangan",
    status: "cadangan",
  });

  assert.equal(perubahan.length, 3);
  assert.equal(perubahan[0].dari, null);
});

test("perubahan yang hanya berbeda tipe tidak dianggap berubah", () => {
  // Basis data mengembalikan numeric sebagai string; tanpa perbandingan
  // teks, tiap suntingan kecil akan tampak mengubah seluruh angkanya.
  assert.deepEqual(
    bandingkanJejak(
      { nilai_perolehan: "27400000.00", masa_manfaat: 48 },
      { nilai_perolehan: "27400000.00", masa_manfaat: 48 },
    ),
    [],
  );
});
