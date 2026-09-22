import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  AMBANG_WASPADA,
  BATAS_ALOKASI_CEO,
  alokasiDisetujui,
  anggaranBentrok,
  bacaSaringanAnggaran,
  bandingPeriode,
  judulAnggaran,
  izinPutusAlokasi,
  penyetujuAlokasi,
  periksaAlokasi,
  periksaAnggaran,
  perpindahanAlokasiSah,
  periodeAnggaran,
  realisasiAnggaran,
  rekapDivisi,
  ringkasAnggaran,
  saringAnggaran,
  selisihTerbesar,
  statusAnggaran,
  totalDivisi,
  type AlokasiAnggaran,
  type Anggaran,
  type MasukanAlokasi,
  type MasukanAnggaran,
} from "../budget.ts";
import type { Transaksi } from "../keuangan.ts";

const anggaran = (b: Partial<Anggaran> = {}): Anggaran => ({
  id: b.id ?? Math.random().toString(36),
  periode: b.periode ?? "2024-10",
  unitKode: b.unitKode ?? null,
  unitNama: b.unitNama ?? "Perusahaan",
  jenis: b.jenis ?? "beban",
  jumlah: b.jumlah ?? 10_000_000,
  catatan: b.catatan ?? "",
  disetujuiNama: b.disetujuiNama ?? null,
});

const transaksi = (b: Partial<Transaksi> = {}): Transaksi => ({
  id: b.id ?? Math.random().toString(36),
  tanggal: b.tanggal ?? "2024-10-10",
  arah: b.arah ?? "keluar",
  jenis: b.jenis ?? "beban",
  unitKode: b.unitKode ?? null,
  unitNama: b.unitNama ?? "Perusahaan",
  akunUsername: null,
  keterangan: b.keterangan ?? "Uji",
  jumlah: b.jumlah ?? 1_000_000,
  status: b.status ?? "dibayar",
  diajukanId: null,
  diajukanNama: null,
  disetujuiNama: null,
});

test("status anggaran menandai mepet sebelum pagunya habis", () => {
  assert.equal(statusAnggaran(10_000_000, 0), "belum");
  assert.equal(statusAnggaran(10_000_000, 5_000_000), "aman");
  assert.equal(
    statusAnggaran(10_000_000, 10_000_000 * AMBANG_WASPADA),
    "waspada",
  );
  assert.equal(statusAnggaran(10_000_000, 10_000_000), "waspada");
  assert.equal(statusAnggaran(10_000_000, 10_000_001), "lewat");
  // Belanja tanpa pagu bukan "aman", ia memang di luar anggaran.
  assert.equal(statusAnggaran(0, 500_000), "lewat");
});

test("realisasi hanya menghitung transaksi yang sudah dibayar", () => {
  const [baris] = realisasiAnggaran(
    [anggaran({ jumlah: 10_000_000 })],
    [
      transaksi({ jumlah: 4_000_000, status: "dibayar" }),
      transaksi({ jumlah: 3_000_000, status: "disetujui" }),
      transaksi({ jumlah: 9_000_000, status: "diajukan" }),
      transaksi({ jumlah: 9_000_000, status: "ditolak" }),
    ],
  );

  assert.equal(baris.realisasi, 4_000_000, "hanya yang dibayar");
  assert.equal(baris.tertahan, 3_000_000, "disetujui tapi belum dibayar");
  assert.equal(baris.sisa, 6_000_000);
  assert.equal(baris.status, "aman");
});

test("transaksi dipetakan ke pos yang tepat", () => {
  const baris = realisasiAnggaran(
    [
      anggaran({
        id: "mcn",
        unitKode: "mcn",
        unitNama: "MCN",
        jumlah: 5_000_000,
      }),
      anggaran({ id: "pusat", unitKode: null, jumlah: 5_000_000 }),
    ],
    [
      transaksi({ unitKode: "mcn", jumlah: 2_000_000 }),
      transaksi({ unitKode: null, jumlah: 1_000_000 }),
      // Jenis lain tidak boleh ikut ke pos beban.
      transaksi({ unitKode: null, jenis: "aset", jumlah: 9_000_000 }),
      // Bulan lain pun tidak.
      transaksi({ unitKode: null, tanggal: "2024-09-10", jumlah: 9_000_000 }),
      // Uang masuk jelas bukan realisasi belanja.
      transaksi({ arah: "masuk", jenis: null, jumlah: 9_000_000 }),
    ],
  );

  const mcn = baris.find((b) => b.anggaran.id === "mcn")!;
  const pusat = baris.find((b) => b.anggaran.id === "pusat")!;
  assert.equal(mcn.realisasi, 2_000_000);
  assert.equal(pusat.realisasi, 1_000_000);
});

test("baris diurutkan dari yang paling dekat batasnya", () => {
  const baris = realisasiAnggaran(
    [
      anggaran({ id: "longgar", jumlah: 10_000_000 }),
      anggaran({ id: "jebol", jumlah: 1_000_000 }),
    ],
    [
      transaksi({ jumlah: 1_000_000 }),
      transaksi({ jumlah: 1_000_000 }),
      transaksi({ jumlah: 1_000_000 }),
    ],
  );

  // Keduanya menyerap transaksi yang sama (pos perusahaan/beban), jadi
  // yang pagunya kecil jauh lebih dulu terlihat.
  assert.equal(baris[0].anggaran.id, "jebol");
  assert.equal(baris[0].status, "lewat");
});

test("ringkasan menjumlahkan dan menghitung pos bermasalah", () => {
  const baris = realisasiAnggaran(
    [
      anggaran({
        id: "a",
        jumlah: 10_000_000,
        unitKode: "mcn",
        unitNama: "MCN",
      }),
      anggaran({
        id: "b",
        jumlah: 2_000_000,
        unitKode: "tap",
        unitNama: "TAP",
      }),
    ],
    [
      transaksi({ unitKode: "mcn", jumlah: 9_000_000 }),
      transaksi({ unitKode: "tap", jumlah: 3_000_000 }),
    ],
  );
  const r = ringkasAnggaran(baris);

  assert.equal(r.anggaran, 12_000_000);
  assert.equal(r.realisasi, 12_000_000);
  assert.equal(r.sisa, 0);
  assert.equal(r.lewat, 1, "pos TAP jebol");
  assert.equal(r.waspada, 1, "pos MCN sudah 90%");
});

test("periode diurutkan dari yang terbaru", () => {
  assert.deepEqual(
    periodeAnggaran([
      anggaran({ periode: "2024-09" }),
      anggaran({ periode: "2024-10" }),
      anggaran({ periode: "2024-09" }),
    ]),
    ["2024-10", "2024-09"],
  );
});

test("judul baris bisa dibaca tanpa melihat kolom lain", () => {
  assert.equal(
    judulAnggaran(anggaran({ jenis: "creator_share", unitNama: "MCN" })),
    "Creator share · MCN",
  );
});

test("rekap divisi menjajarkan periode sebagai kolom", () => {
  const baris = rekapDivisi(
    [
      anggaran({
        periode: "2024-10",
        unitKode: "mcn",
        unitNama: "MCN",
        jumlah: 10_000_000,
      }),
      anggaran({
        periode: "2024-09",
        unitKode: "mcn",
        unitNama: "MCN",
        jumlah: 8_000_000,
      }),
      anggaran({
        periode: "2024-10",
        unitNama: "Perusahaan",
        jumlah: 5_000_000,
      }),
    ],
    [
      transaksi({ unitKode: "mcn", unitNama: "MCN", jumlah: 9_000_000 }),
      transaksi({
        unitKode: "mcn",
        unitNama: "MCN",
        tanggal: "2024-09-10",
        jumlah: 2_000_000,
      }),
    ],
    ["2024-10", "2024-09"],
  );

  const mcn = baris.find((b) => b.unitNama === "MCN")!;
  assert.equal(mcn.perPeriode["2024-10"].realisasi, 9_000_000);
  assert.equal(mcn.perPeriode["2024-09"].realisasi, 2_000_000);
  assert.equal(
    mcn.total.anggaran,
    18_000_000,
    "pagunya dijumlah antar periode",
  );
  assert.equal(mcn.perPeriode["2024-10"].status, "waspada");

  // Divisi tanpa anggaran di sebuah periode tetap punya selnya, bernilai
  // nol — tabel yang bolong membuat orang mengira datanya hilang.
  const pusat = baris.find((b) => b.unitNama === "Perusahaan")!;
  assert.equal(pusat.perPeriode["2024-09"].anggaran, 0);
});

test("baris total menjumlahkan seluruh divisi per periode", () => {
  const periode = ["2024-10"];
  const baris = rekapDivisi(
    [
      anggaran({ unitKode: "mcn", unitNama: "MCN", jumlah: 4_000_000 }),
      anggaran({ unitKode: "tap", unitNama: "TAP", jumlah: 6_000_000 }),
    ],
    [
      transaksi({ unitKode: "mcn", unitNama: "MCN", jumlah: 1_000_000 }),
      transaksi({ unitKode: "tap", unitNama: "TAP", jumlah: 2_000_000 }),
    ],
    periode,
  );
  const total = totalDivisi(baris, periode);

  assert.equal(total.perPeriode["2024-10"].anggaran, 10_000_000);
  assert.equal(total.perPeriode["2024-10"].realisasi, 3_000_000);
  assert.equal(Math.round(total.total.rasio), 30);
});

const isian = (b: Partial<MasukanAnggaran> = {}): MasukanAnggaran => ({
  periode: b.periode ?? "2024-10",
  unitKode: b.unitKode ?? null,
  jenis: b.jenis ?? "beban",
  jumlah: b.jumlah ?? 5_000_000,
  catatan: b.catatan ?? "",
});

test("isian anggaran yang wajar diterima", () => {
  assert.equal(periksaAnggaran(isian()), null);
});

test("pagu nol ditolak karena artinya kabur", () => {
  // "Dianggarkan nol" dan "belum dianggarkan" terlihat sama di layar
  // tetapi berarti sebaliknya bagi yang membelanjakannya.
  assert.ok(periksaAnggaran(isian({ jumlah: 0 })));
  assert.ok(periksaAnggaran(isian({ jumlah: -1 })));
});

test("periode harus berbentuk bulan yang mungkin", () => {
  assert.ok(periksaAnggaran(isian({ periode: "2024-13" })));
  assert.ok(periksaAnggaran(isian({ periode: "Oktober" })));
  assert.equal(periksaAnggaran(isian({ periode: "2024-01" })), null);
});

test("pos yang sama tidak boleh dipagu dua kali", () => {
  const ada = [
    anggaran({ id: "a", periode: "2024-10", unitKode: "mcn", jenis: "beban" }),
  ];

  assert.equal(
    anggaranBentrok(ada, isian({ unitKode: "mcn", jenis: "beban" })),
    true,
  );
  // Membetulkan baris yang sama bukan bentrokan dengan dirinya sendiri.
  assert.equal(
    anggaranBentrok(ada, isian({ unitKode: "mcn", jenis: "beban" }), "a"),
    false,
  );
  // Jenis atau periode berbeda adalah pos yang berbeda.
  assert.equal(
    anggaranBentrok(ada, isian({ unitKode: "mcn", jenis: "aset" })),
    false,
  );
  assert.equal(
    anggaranBentrok(ada, isian({ periode: "2024-11", unitKode: "mcn" })),
    false,
  );
});

test("selisih diurutkan dari rupiah terbesar, bukan persentase", () => {
  const baris = realisasiAnggaran(
    [
      anggaran({
        id: "kecil",
        unitKode: "mcn",
        unitNama: "MCN",
        jumlah: 2_000_000,
      }),
      anggaran({
        id: "besar",
        unitKode: "tap",
        unitNama: "TAP",
        jumlah: 200_000_000,
      }),
    ],
    [
      // Pos kecil jebol 200%, pos besar hanya lewat 5% — tetapi lewatnya
      // yang besar memakan kas sepuluh kali lipat lebih banyak.
      transaksi({ unitKode: "mcn", unitNama: "MCN", jumlah: 6_000_000 }),
      transaksi({ unitKode: "tap", unitNama: "TAP", jumlah: 210_000_000 }),
    ],
  );

  const urut = selisihTerbesar(baris);
  assert.equal(urut[0].baris.anggaran.id, "besar");
  assert.equal(urut[0].selisih, 10_000_000);
  assert.equal(urut[1].selisih, 4_000_000);
});

test("pos yang hemat memberi selisih negatif", () => {
  const baris = realisasiAnggaran(
    [anggaran({ jumlah: 10_000_000 })],
    [transaksi({ jumlah: 4_000_000 })],
  );
  assert.equal(selisihTerbesar(baris)[0].selisih, -6_000_000);
});

test("saringan menolak periode yang tidak tersedia", () => {
  const tersedia = ["2024-10", "2024-09"];
  assert.equal(
    bacaSaringanAnggaran({ periode: "2024-08" }, tersedia, "2024-10").periode,
    "2024-10",
    "jatuh ke bawaannya, bukan menampilkan halaman kosong",
  );
  assert.equal(
    bacaSaringanAnggaran({ periode: "2024-09" }, tersedia, "2024-10").periode,
    "2024-09",
  );
  assert.equal(bacaSaringanAnggaran({}, tersedia, "2024-10").unit, "semua");
});

test("saringan divisi menyisakan pos divisi itu saja", () => {
  const daftar = [
    anggaran({ periode: "2024-10", unitNama: "MCN" }),
    anggaran({ periode: "2024-10", unitNama: "TAP" }),
    anggaran({ periode: "2024-09", unitNama: "MCN" }),
  ];

  assert.equal(
    saringAnggaran(daftar, { periode: "2024-10", unit: "MCN" }).length,
    1,
  );
  assert.equal(
    saringAnggaran(daftar, { periode: "2024-10", unit: "semua" }).length,
    2,
  );
});

test("indikator selisih membandingkan serapan antar periode", () => {
  const sekarang = realisasiAnggaran(
    [anggaran({ periode: "2024-10", jumlah: 10_000_000 })],
    [transaksi({ jumlah: 9_000_000 })],
  );
  const sebelumnya = realisasiAnggaran(
    [anggaran({ periode: "2024-09", jumlah: 10_000_000 })],
    [transaksi({ tanggal: "2024-09-10", jumlah: 5_000_000 })],
  );

  const b = bandingPeriode(sekarang, sebelumnya, "2024-09");
  assert.equal(b.periode, "2024-09");
  assert.equal(b.selisihRealisasi, 4_000_000);
  assert.equal(Math.round(b.selisihRasio), 40, "serapan naik 40 poin");
});

test("tanpa periode sebelumnya, indikatornya tidak mengarang arah", () => {
  const b = bandingPeriode([], [], null);
  assert.equal(b.periode, null);
  assert.equal(b.selisihRasio, 0);
});

const pengajuan = (b: Partial<MasukanAlokasi> = {}): MasukanAlokasi => ({
  periode: b.periode ?? "2024-10",
  unitKode: b.unitKode ?? null,
  jenis: b.jenis ?? "beban",
  jumlah: b.jumlah ?? 3_000_000,
  alasan: b.alasan ?? "Konsumsi rapat mingguan bertambah sejak Oktober.",
});

test("pengajuan alokasi wajib beralasan", () => {
  assert.equal(periksaAlokasi(pengajuan()), null);
  // Yang memutuskan tidak ikut menjalankan pekerjaannya.
  assert.ok(periksaAlokasi(pengajuan({ alasan: "butuh" })));
  assert.ok(periksaAlokasi(pengajuan({ jumlah: 0 })));
});

test("keputusan hanya berlaku sekali", () => {
  assert.equal(perpindahanAlokasiSah("diajukan", "disetujui"), true);
  assert.equal(perpindahanAlokasiSah("diajukan", "ditolak"), true);
  // Memutar balik keputusan diam-diam menghapus jejak siapa memutuskan apa.
  assert.equal(perpindahanAlokasiSah("disetujui", "ditolak"), false);
  assert.equal(perpindahanAlokasiSah("ditolak", "disetujui"), false);
  assert.equal(perpindahanAlokasiSah("diajukan", "diajukan"), false);
});

test("hanya alokasi yang disetujui menambah pagu sebuah pos", () => {
  const pos = {
    periode: "2024-10",
    unitKode: "mcn" as const,
    jenis: "beban" as const,
  };
  const alokasi = [
    {
      ...pos,
      id: "a",
      unitNama: "MCN",
      jumlah: 3_000_000,
      alasan: "",
      status: "disetujui" as const,
      diajukanNama: null,
      diputuskanNama: null,
      catatanKeputusan: "",
      pada: "2024-10-20",
    },
    {
      ...pos,
      id: "b",
      unitNama: "MCN",
      jumlah: 9_000_000,
      alasan: "",
      status: "diajukan" as const,
      diajukanNama: null,
      diputuskanNama: null,
      catatanKeputusan: "",
      pada: "2024-10-21",
    },
    {
      ...pos,
      id: "c",
      unitNama: "MCN",
      jumlah: 9_000_000,
      alasan: "",
      status: "ditolak" as const,
      diajukanNama: null,
      diputuskanNama: null,
      catatanKeputusan: "",
      pada: "2024-10-22",
    },
  ];

  assert.equal(alokasiDisetujui(alokasi, pos), 3_000_000);
  // Pos lain tidak ikut kecipratan.
  assert.equal(alokasiDisetujui(alokasi, { ...pos, jenis: "aset" }), 0);
});

const ajuan = (b: Partial<AlokasiAnggaran> = {}): AlokasiAnggaran => ({
  id: b.id ?? "alokasi-1",
  periode: b.periode ?? "2024-10",
  unitKode: b.unitKode ?? "mcn",
  unitNama: b.unitNama ?? "MCN",
  jenis: b.jenis ?? "beban",
  jumlah: b.jumlah ?? 3_000_000,
  alasan: b.alasan ?? "Konsumsi rapat bertambah.",
  status: b.status ?? "diajukan",
  diajukanNama: b.diajukanNama ?? "Galih Prakoso",
  diputuskanNama: b.diputuskanNama ?? null,
  catatanKeputusan: b.catatanKeputusan ?? "",
  pada: b.pada ?? "2024-10-22",
});

test("wewenang naik ke CEO untuk tambahan besar", () => {
  assert.equal(penyetujuAlokasi(BATAS_ALOKASI_CEO - 1), "Manager");
  assert.equal(penyetujuAlokasi(BATAS_ALOKASI_CEO), "CEO");

  const besar = ajuan({ jumlah: BATAS_ALOKASI_CEO });
  assert.equal(
    izinPutusAlokasi("Manager", "Farhan Pratama", besar).bolehPutuskan,
    false,
  );
  assert.equal(
    izinPutusAlokasi("CEO", "Hafidz Alkahfi", besar).bolehPutuskan,
    true,
  );
});

test("tidak seorang pun memutuskan pengajuannya sendiri", () => {
  const milikManager = ajuan({ diajukanNama: "Farhan Pratama" });
  const izin = izinPutusAlokasi("Manager", "Farhan Pratama", milikManager);

  assert.equal(izin.bolehPutuskan, false);
  assert.match(izin.alasan, /sendiri/i);
});

test("pengajuan yang sudah diputuskan tidak bisa diputuskan lagi", () => {
  assert.equal(
    izinPutusAlokasi("CEO", "Hafidz Alkahfi", ajuan({ status: "disetujui" }))
      .bolehPutuskan,
    false,
  );
});

test("Leader dan Staff bukan pemutus alokasi", () => {
  for (const peran of ["Leader", "Co-Leader", "Staff", "Finance"]) {
    assert.equal(
      izinPutusAlokasi(peran, "Siapa Saja", ajuan()).bolehPutuskan,
      false,
      `${peran} seharusnya tidak memutuskan`,
    );
  }
});
