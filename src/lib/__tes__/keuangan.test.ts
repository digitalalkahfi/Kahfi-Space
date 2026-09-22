import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  BATAS_KAS_CEO,
  penyetujuiWajib,
  ringkasKeuangan,
  waterfallManajemen,
  bolehLihatKeuangan,
  bacaSaringanTransaksi,
  izinPersetujuan,
  perpindahanSah,
  bandingkanWaterfall,
  kontribusiUnit,
  periodeSebelumnya,
  laporanCashFlow,
  laporanLabaRugi,
  periksaTransaksi,
  rentangBulan,
  saringTransaksi,
  statusAwal,
  transaksiTersaring,
  type MasukanTransaksi,
  type Transaksi,
} from "../keuangan.ts";

const t = (b: Partial<Transaksi>): Transaksi => ({
  id: b.id ?? Math.random().toString(36),
  tanggal: b.tanggal ?? "2024-10-10",
  arah: b.arah ?? "keluar",
  jenis: b.jenis ?? null,
  unitKode: null,
  unitNama: "Perusahaan",
  akunUsername: null,
  keterangan: b.keterangan ?? "",
  jumlah: b.jumlah ?? 0,
  status: b.status ?? "dibayar",
  diajukanId: b.diajukanId ?? null,
  diajukanNama: null,
  disetujuiNama: null,
});

test("NPM dihitung terhadap net revenue, bukan pendapatan kotor", () => {
  // Inilah sebab angka lama menyesatkan: membagi laba dengan pendapatan
  // kotor membuat marjin tampak lebih baik daripada kenyataannya.
  const r = ringkasKeuangan([
    t({ arah: "masuk", jumlah: 100_000_000 }),
    t({ jenis: "direct_cost", jumlah: 20_000_000 }),
    t({ jenis: "creator_share", jumlah: 10_000_000 }),
    t({ jenis: "beban", jumlah: 35_000_000 }),
  ]);

  assert.equal(r.netRevenue, 70_000_000);
  assert.equal(r.labaBersih, 35_000_000);
  assert.equal(r.npm, 50);
});

test("pembelian aset tidak mengurangi laba, tetapi mengurangi kas", () => {
  // Membeli barang bernilai memindahkan bentuk kekayaan, bukan
  // menghabiskannya — pencampuran keduanya yang merusak NPM lama.
  const r = ringkasKeuangan(
    [
      t({ arah: "masuk", jumlah: 50_000_000 }),
      t({ jenis: "aset", jumlah: 20_000_000 }),
    ],
    10_000_000,
  );

  assert.equal(r.labaBersih, 50_000_000);
  assert.equal(r.saldoKas, 40_000_000);
});

test("dividen memakai laba, bukan mengurangi laba", () => {
  const r = ringkasKeuangan([
    t({ arah: "masuk", jumlah: 80_000_000 }),
    t({ jenis: "dividen", jumlah: 30_000_000 }),
  ]);

  assert.equal(r.labaBersih, 80_000_000);
  assert.equal(r.saldoKas, 50_000_000);
});

test("hanya transaksi yang sudah dibayar menggerakkan kas", () => {
  // Pengajuan yang belum disetujui tidak boleh terlihat seperti uang
  // yang sudah keluar.
  const r = ringkasKeuangan([
    t({ arah: "masuk", jumlah: 40_000_000 }),
    t({ jenis: "beban", jumlah: 10_000_000, status: "diajukan" }),
    t({ jenis: "beban", jumlah: 5_000_000, status: "disetujui" }),
    t({ jenis: "beban", jumlah: 1_000_000, status: "ditolak" }),
  ]);

  assert.equal(r.beban, 0);
  assert.equal(r.saldoKas, 40_000_000);
  assert.equal(r.menungguPersetujuan, 10_000_000);
});

test("kas di bawah batas menaikkan persetujuan ke CEO", () => {
  assert.equal(penyetujuiWajib(BATAS_KAS_CEO - 1), "CEO");
  assert.equal(penyetujuiWajib(BATAS_KAS_CEO), "Manager");
});

test("tanpa pendapatan, NPM tidak dipaksa menjadi angka", () => {
  const r = ringkasKeuangan([t({ jenis: "beban", jumlah: 5_000_000 })]);
  assert.equal(r.npm, 0);
  assert.equal(r.labaBersih, -5_000_000);
});

test("waterfall berakhir pada laba bersih dan menjumlah konsisten", () => {
  const r = ringkasKeuangan([
    t({ arah: "masuk", jumlah: 100_000_000 }),
    t({ jenis: "direct_cost", jumlah: 20_000_000 }),
    t({ jenis: "beban", jumlah: 30_000_000 }),
  ]);
  const baris = waterfallManajemen(r);

  assert.equal(baris.at(-1)?.label, "Laba bersih");
  assert.equal(baris.at(-1)?.nilai, r.labaBersih);

  // Penjumlahan baris non-total harus sampai ke laba bersih.
  const jumlah = baris.filter((b) => !b.total).reduce((a, b) => a + b.nilai, 0);
  assert.equal(jumlah, r.labaBersih);
});

test("modul keuangan hanya terbuka untuk Finance, Manager, dan CEO", () => {
  for (const peran of ["Finance", "Manager", "CEO"]) {
    assert.equal(bolehLihatKeuangan(peran), true, peran);
  }
  for (const peran of ["Leader", "Co-Leader", "Staff"]) {
    assert.equal(bolehLihatKeuangan(peran), false, peran);
  }
});

const isian = (b: Partial<MasukanTransaksi>): MasukanTransaksi => ({
  tanggal: b.tanggal ?? "2024-10-21",
  arah: b.arah ?? "keluar",
  jenis: "jenis" in b ? b.jenis! : "beban",
  unitKode: b.unitKode ?? null,
  akunUsername: b.akunUsername ?? null,
  keterangan: b.keterangan ?? "Iklan akun skincare",
  jumlah: b.jumlah ?? 5_000_000,
});

test("pengeluaran tanpa jenis ditolak", () => {
  // Tanpa jenis, beban dan aset kembali bercampur — persis cacat lama.
  assert.match(
    periksaTransaksi(isian({ jenis: null })) ?? "",
    /wajib berjenis/i,
  );
  assert.equal(periksaTransaksi(isian({ jenis: "aset" })), null);
});

test("pemasukan wajib menyebut unit dan tanpa jenis pengeluaran", () => {
  assert.match(
    periksaTransaksi(isian({ arah: "masuk", jenis: null })) ?? "",
    /unit pendapatan/i,
  );
  assert.match(
    periksaTransaksi(
      isian({ arah: "masuk", jenis: "beban", unitKode: "mcn" }),
    ) ?? "",
    /tidak memakai jenis/i,
  );
  assert.equal(
    periksaTransaksi(isian({ arah: "masuk", jenis: null, unitKode: "mcn" })),
    null,
  );
});

test("direct cost harus menempel pada unit", () => {
  assert.match(
    periksaTransaksi(isian({ jenis: "direct_cost" })) ?? "",
    /unit/i,
  );
  assert.equal(
    periksaTransaksi(isian({ jenis: "direct_cost", unitKode: "affiliator" })),
    null,
  );
});

test("nominal dan keterangan dijaga seperlunya", () => {
  assert.match(periksaTransaksi(isian({ jumlah: 0 })) ?? "", /lebih dari nol/i);
  assert.match(
    periksaTransaksi(isian({ jumlah: -1 })) ?? "",
    /lebih dari nol/i,
  );
  assert.match(
    periksaTransaksi(isian({ keterangan: "abc" })) ?? "",
    /keterangan/i,
  );
  assert.match(
    periksaTransaksi(isian({ tanggal: "21-10-2024" })) ?? "",
    /tanggal/i,
  );
});

test("pemasukan langsung tercatat, pengeluaran selalu menunggu", () => {
  assert.equal(statusAwal("masuk"), "dibayar");
  assert.equal(statusAwal("keluar"), "diajukan");
});

const daftar: Transaksi[] = [
  t({
    id: "a",
    arah: "masuk",
    jenis: null,
    jumlah: 50_000_000,
    tanggal: "2024-10-05",
  }),
  t({ id: "b", jenis: "beban", jumlah: 10_000_000, tanggal: "2024-10-12" }),
  t({
    id: "c",
    jenis: "aset",
    jumlah: 20_000_000,
    tanggal: "2024-11-02",
    status: "diajukan",
  }),
];

test("saringan periode memotong di kedua ujungnya", () => {
  const hasil = saringTransaksi(daftar, {
    ...bacaSaringanTransaksi({}),
    dari: "2024-10-01",
    sampai: "2024-10-31",
  });
  assert.deepEqual(
    hasil.map((x) => x.id),
    ["a", "b"],
  );
});

test("saringan arah dan jenis bisa ditumpuk", () => {
  const hasil = saringTransaksi(daftar, {
    ...bacaSaringanTransaksi({}),
    arah: "keluar",
    jenis: "aset",
  });
  assert.deepEqual(
    hasil.map((x) => x.id),
    ["c"],
  );
});

test("pencarian menjangkau keterangan dan akunnya", () => {
  const khusus = [
    t({
      id: "x",
      keterangan: "Iklan akun skincare",
      akunUsername: "@skincare_official",
    }),
    t({ id: "y", keterangan: "Sewa kantor" }),
  ];

  assert.deepEqual(
    saringTransaksi(khusus, {
      ...bacaSaringanTransaksi({}),
      cari: "skincare",
    }).map((x) => x.id),
    ["x"],
  );
  assert.deepEqual(
    saringTransaksi(khusus, { ...bacaSaringanTransaksi({}), cari: "sewa" }).map(
      (x) => x.id,
    ),
    ["y"],
  );
});

test("nilai saringan yang tidak dikenal diabaikan", () => {
  const dibaca = bacaSaringanTransaksi({
    arah: "melayang",
    jenis: "entah",
    status: "mungkin",
    dari: "kemarin",
  });
  assert.equal(dibaca.arah, "semua");
  assert.equal(dibaca.jenis, "semua");
  assert.equal(dibaca.status, "semua");
  assert.equal(dibaca.dari, "");
  assert.equal(transaksiTersaring(dibaca), false);
});

test("rentang bulan menutup sampai hari terakhirnya", () => {
  assert.deepEqual(rentangBulan("2024-10-21"), {
    dari: "2024-10-01",
    sampai: "2024-10-31",
  });
  // Februari kabisat tidak boleh terpotong di tanggal 28.
  assert.deepEqual(rentangBulan("2024-02-10"), {
    dari: "2024-02-01",
    sampai: "2024-02-29",
  });
});

test("arus kas berakhir pada saldo akhir yang benar", () => {
  const r = ringkasKeuangan(
    [
      t({ arah: "masuk", jumlah: 100_000_000 }),
      t({ jenis: "beban", jumlah: 30_000_000 }),
      t({ jenis: "aset", jumlah: 20_000_000 }),
      t({ jenis: "dividen", jumlah: 10_000_000 }),
    ],
    50_000_000,
  );
  const baris = laporanCashFlow(r, 50_000_000);

  assert.equal(baris[0].label, "Saldo kas awal");
  assert.equal(baris[0].nilai, 50_000_000);
  assert.equal(baris.at(-1)?.label, "Saldo kas akhir");
  assert.equal(baris.at(-1)?.nilai, r.saldoKas);
  assert.equal(r.saldoKas, 90_000_000);
});

test("arus kas memisahkan operasi, investasi, dan pendanaan", () => {
  const r = ringkasKeuangan([
    t({ arah: "masuk", jumlah: 80_000_000 }),
    t({ jenis: "beban", jumlah: 20_000_000 }),
    t({ jenis: "aset", jumlah: 15_000_000 }),
  ]);
  const baris = laporanCashFlow(r, 0);
  const operasi = baris.find((b) => b.label === "Arus kas operasi");

  // Pembelian aset tidak boleh ikut ke arus operasi.
  assert.equal(operasi?.nilai, 60_000_000);
  assert.equal(
    baris.find((b) => b.label === "Pembelian aset")?.nilai,
    -15_000_000,
  );
});

test("laba rugi tidak memuat aset maupun dividen", () => {
  // Menampilkannya di sini akan mengulangi kesalahan NPM sistem lama.
  const r = ringkasKeuangan([
    t({ arah: "masuk", jumlah: 70_000_000 }),
    t({ jenis: "aset", jumlah: 30_000_000 }),
    t({ jenis: "dividen", jumlah: 10_000_000 }),
  ]);
  const label = laporanLabaRugi(r).map((b) => b.label.toLowerCase());

  assert.equal(
    label.some((l) => l.includes("aset") || l.includes("dividen")),
    false,
  );
  assert.equal(laporanLabaRugi(r).at(-1)?.nilai, 70_000_000);
});

test("kontribusi unit hanya memuat yang melekat pada unitnya", () => {
  // Beban perusahaan tidak dibagi-bagi: pembagiannya selalu sewenang-wenang.
  const unit = (nama: string, b: Partial<Transaksi>): Transaksi => ({
    ...t(b),
    unitNama: nama,
  });

  const hasil = kontribusiUnit([
    unit("Affiliator", { arah: "masuk", jenis: null, jumlah: 100_000_000 }),
    unit("Affiliator", { jenis: "direct_cost", jumlah: 20_000_000 }),
    unit("MCN", { arah: "masuk", jenis: null, jumlah: 60_000_000 }),
    unit("MCN", { jenis: "creator_share", jumlah: 20_000_000 }),
    unit("Perusahaan", { jenis: "beban", jumlah: 50_000_000 }),
  ]);

  assert.deepEqual(
    hasil.map((u) => u.unitNama),
    ["Affiliator", "MCN"],
  );
  assert.equal(hasil[0].netRevenue, 80_000_000);
  assert.equal(hasil[1].netRevenue, 40_000_000);
  assert.equal(hasil[0].porsi, 66.7);
});

test("sebulan penuh dibandingkan dengan bulan sebelumnya", () => {
  // "Dibanding bulan lalu" berarti bulan kalender, meski harinya berbeda.
  assert.deepEqual(periodeSebelumnya("2024-10-01", "2024-10-31"), {
    dari: "2024-09-01",
    sampai: "2024-09-30",
  });
  assert.deepEqual(periodeSebelumnya("2024-03-01", "2024-03-31"), {
    dari: "2024-02-01",
    sampai: "2024-02-29",
  });
});

test("rentang selain sebulan memakai jendela sepanjang hari yang sama", () => {
  assert.deepEqual(periodeSebelumnya("2024-10-21", "2024-10-27"), {
    dari: "2024-10-14",
    sampai: "2024-10-20",
  });
});

test("pembanding waterfall menyebut selisih tiap langkah", () => {
  const sekarang = ringkasKeuangan([
    t({ arah: "masuk", jumlah: 120_000_000 }),
    t({ jenis: "beban", jumlah: 40_000_000 }),
  ]);
  const lalu = ringkasKeuangan([
    t({ arah: "masuk", jumlah: 100_000_000 }),
    t({ jenis: "beban", jumlah: 50_000_000 }),
  ]);

  const baris = bandingkanWaterfall(sekarang, lalu);
  const pendapatan = baris.find((b) => b.label === "Pendapatan");
  const beban = baris.find((b) => b.label === "Beban");
  const laba = baris.find((b) => b.label === "Laba bersih");

  assert.equal(pendapatan?.selisih, 20_000_000);
  // Beban turun: nilainya negatif, jadi selisihnya positif.
  assert.equal(beban?.selisih, 10_000_000);
  assert.equal(laba?.selisih, 30_000_000);
});

test("kas menipis menaikkan keputusan ke CEO", () => {
  const tipis = BATAS_KAS_CEO - 1;
  assert.equal(
    izinPersetujuan("Manager", "m1", null, tipis).bolehPutuskan,
    false,
  );
  assert.equal(izinPersetujuan("CEO", "c1", null, tipis).bolehPutuskan, true);

  const cukup = BATAS_KAS_CEO;
  assert.equal(
    izinPersetujuan("Manager", "m1", null, cukup).bolehPutuskan,
    true,
  );
});

test("tidak seorang pun menyetujui pengajuannya sendiri", () => {
  // Persetujuan yang bisa diberikan kepada diri sendiri tidak menahan apa pun.
  const izin = izinPersetujuan("Manager", "m1", "m1", BATAS_KAS_CEO * 2);
  assert.equal(izin.bolehPutuskan, false);
  assert.match(izin.alasan, /sendiri/i);

  assert.equal(
    izinPersetujuan("CEO", "c1", "c1", BATAS_KAS_CEO * 2).bolehPutuskan,
    false,
  );
});

test("Finance mengajukan, bukan memutuskan", () => {
  assert.equal(
    izinPersetujuan("Finance", "f1", null, BATAS_KAS_CEO * 2).bolehPutuskan,
    false,
  );
});

test("perpindahan status pengajuan mengikuti alurnya", () => {
  assert.equal(perpindahanSah("diajukan", "disetujui"), true);
  assert.equal(perpindahanSah("diajukan", "ditolak"), true);
  assert.equal(perpindahanSah("diajukan", "dibayar"), false);
  assert.equal(perpindahanSah("disetujui", "dibayar"), true);
  assert.equal(perpindahanSah("disetujui", "ditolak"), false);
  assert.equal(perpindahanSah("ditolak", "disetujui"), false);
  assert.equal(perpindahanSah("dibayar", "diajukan"), false);
});

test("izin persetujuan hanya berisi data, tanpa fungsi", () => {
  // Nilainya menyeberang dari Server ke Client Component.
  const izin = izinPersetujuan("CEO", "c1", null, 0);
  for (const [kunci, nilai] of Object.entries(izin)) {
    assert.notEqual(typeof nilai, "function", `${kunci} tidak boleh fungsi`);
  }
});
