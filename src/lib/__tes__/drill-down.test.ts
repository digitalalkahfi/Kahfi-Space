import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bacaDimensi,
  bacaKembali,
  bekalKembali,
  drillDown,
  saringanDrill,
} from "../drill-down.ts";
import type { Transaksi } from "../keuangan.ts";

const t = (b: Partial<Transaksi> = {}): Transaksi => ({
  id: b.id ?? Math.random().toString(36),
  tanggal: b.tanggal ?? "2024-10-10",
  arah: b.arah ?? "keluar",
  jenis: b.jenis ?? "beban",
  unitKode: b.unitKode ?? null,
  unitNama: b.unitNama ?? "Perusahaan",
  akunUsername: b.akunUsername ?? null,
  keterangan: "Uji",
  jumlah: b.jumlah ?? 1_000_000,
  status: b.status ?? "dibayar",
  diajukanId: null,
  diajukanNama: null,
  disetujuiNama: null,
});

test("hanya transaksi yang sudah dibayar ikut dibedah", () => {
  const baris = drillDown(
    [
      t({ jumlah: 2_000_000, status: "dibayar" }),
      t({ jumlah: 9_000_000, status: "disetujui" }),
      t({ jumlah: 9_000_000, status: "diajukan" }),
    ],
    "divisi",
  );

  assert.equal(baris.length, 1);
  assert.equal(baris[0].biaya, 2_000_000);
  assert.equal(baris[0].jumlahTransaksi, 1);
});

test("net dihitung dari pemasukan dikurangi biaya kelompoknya", () => {
  const baris = drillDown(
    [
      t({ arah: "masuk", jenis: null, unitNama: "MCN", jumlah: 10_000_000 }),
      t({ unitNama: "MCN", jumlah: 4_000_000 }),
      t({ unitNama: "TAP", jumlah: 1_000_000 }),
    ],
    "divisi",
  );

  const mcn = baris.find((b) => b.label === "MCN")!;
  assert.equal(mcn.pendapatan, 10_000_000);
  assert.equal(mcn.biaya, 4_000_000);
  assert.equal(mcn.net, 6_000_000);

  // Divisi dengan net terbesar lebih dulu.
  assert.equal(baris[0].label, "MCN");
});

test("transaksi tanpa akun tidak dijadikan kelompok kosong", () => {
  const baris = drillDown(
    [
      t({ akunUsername: "@skincare", jumlah: 2_000_000 }),
      t({ akunUsername: null, jumlah: 5_000_000 }),
    ],
    "akun",
  );

  assert.equal(baris.length, 1, "yang tanpa akun memang bukan belanja akun");
  assert.equal(baris[0].label, "@skincare");
});

test("bedah per periode diurutkan dari yang terbaru", () => {
  const baris = drillDown(
    [
      t({ tanggal: "2024-09-10" }),
      t({ tanggal: "2024-10-10" }),
      t({ tanggal: "2024-08-10" }),
    ],
    "periode",
  );

  assert.deepEqual(
    baris.map((b) => b.label),
    ["2024-10", "2024-09", "2024-08"],
  );
});

test("porsi dihitung terhadap besaran mutlak, bukan saling meniadakan", () => {
  const baris = drillDown(
    [
      t({ arah: "masuk", jenis: null, unitNama: "MCN", jumlah: 10_000_000 }),
      t({ unitNama: "TAP", jumlah: 10_000_000 }),
    ],
    "divisi",
  );

  // Tanpa nilai mutlak, total nol membuat kedua porsi jadi nol.
  assert.equal(baris[0].porsi, 50);
  assert.equal(baris[1].porsi, 50);
});

test("dimensi yang tidak dikenal jatuh ke divisi", () => {
  assert.equal(bacaDimensi("akun"), "akun");
  assert.equal(bacaDimensi("entah"), "divisi");
  assert.equal(bacaDimensi(undefined), "divisi");
});

const baris = (kunci: string, label = kunci) => ({
  label,
  kunci,
  pendapatan: 0,
  biaya: 0,
  net: 0,
  jumlahTransaksi: 0,
  porsi: 0,
});

test("tiap dimensi menghasilkan saringan transaksi yang tepat", () => {
  assert.deepEqual(saringanDrill(baris("MCN"), "divisi"), { unit: "MCN" });
  assert.deepEqual(saringanDrill(baris("@skincare"), "akun"), {
    cari: "@skincare",
  });
  assert.deepEqual(saringanDrill(baris("beban"), "jenis"), { jenis: "beban" });
  assert.deepEqual(saringanDrill(baris("masuk"), "jenis"), { arah: "masuk" });
  assert.deepEqual(saringanDrill(baris("2024-02"), "periode"), {
    dari: "2024-02-01",
    sampai: "2024-02-29",
  });
});

test("bekal kembali hanya membawa saringan dasbor", () => {
  const params = new URLSearchParams({
    periode: "mingguan",
    acuan: "2024-10-14",
    drill: "akun",
    // Saringan halaman lain tidak boleh ikut pulang.
    cari: "laptop",
    status: "diajukan",
  });

  const bekal = bekalKembali(params);
  assert.match(bekal, /^\?/);
  assert.ok(bekal.includes("periode=mingguan"));
  assert.ok(bekal.includes("drill=akun"));
  assert.ok(!bekal.includes("cari="));
  assert.ok(!bekal.includes("status="));
});

test("bekal kembali menolak apa pun yang bukan query string", () => {
  assert.equal(
    bacaKembali("?periode=bulanan&drill=akun"),
    "?periode=bulanan&drill=akun",
  );
  // Tanpa penyaringan, `kembali` bisa dipakai melempar orang keluar.
  assert.equal(bacaKembali("https://situs-lain.example"), "");
  assert.equal(bacaKembali("//situs-lain.example"), "");
  assert.equal(bacaKembali("/keuangan"), "");
  assert.equal(bacaKembali(undefined), "");
});
