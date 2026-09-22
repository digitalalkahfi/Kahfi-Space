import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bacaSaringanScan,
  saringScan,
  scanTersaring,
  bacaSaringanRiwayat,
  riwayatTersaring,
  saringRiwayat,
  type BarisRiwayat,
  type BarisScan,
} from "../saring-sampel.ts";

const baris = (b: Partial<BarisRiwayat>): BarisRiwayat => ({
  id: Math.random().toString(36),
  sampelId: "s1",
  kode: "SMP-0001",
  namaSampel: "Serum Vitamin C",
  unitNama: "Affiliator Network",
  dari: "tersedia",
  ke: "dipegang",
  olehNama: "Farhan Pratama",
  pemegangNama: "Rian Hidayat",
  kreator: "",
  catatan: "",
  pada: "2024-10-20T10:00:00Z",
  ...b,
});

const daftar: BarisRiwayat[] = [
  baris({}),
  baris({
    ke: "dikirim",
    kreator: "@dinda.makeup",
    pada: "2024-10-22T10:00:00Z",
  }),
  baris({
    kode: "SMP-0007",
    namaSampel: "Lampu Meja LED",
    unitNama: "MCN",
    ke: "hilang",
    pada: "2024-10-25T10:00:00Z",
  }),
];

test("tanpa saringan semua lolos", () => {
  const s = bacaSaringanRiwayat({});
  assert.equal(riwayatTersaring(s), false);
  assert.equal(saringRiwayat(daftar, s).length, 3);
});

test("saringan status bekerja", () => {
  const s = bacaSaringanRiwayat({ status: "hilang" });
  assert.deepEqual(
    saringRiwayat(daftar, s).map((b) => b.kode),
    ["SMP-0007"],
  );
});

test("status yang tidak dikenal diabaikan", () => {
  const s = bacaSaringanRiwayat({ status: "melayang" });
  assert.equal(s.status, "semua");
  assert.equal(saringRiwayat(daftar, s).length, 3);
});

test("rentang tanggal menyaring inklusif di kedua ujung", () => {
  const s = bacaSaringanRiwayat({ dari: "2024-10-22", sampai: "2024-10-25" });
  assert.equal(saringRiwayat(daftar, s).length, 2);
});

test("tanggal yang tidak berbentuk diabaikan", () => {
  const s = bacaSaringanRiwayat({ dari: "kemarin" });
  assert.equal(s.dari, "");
  assert.equal(saringRiwayat(daftar, s).length, 3);
});

test("pencarian mencakup kode, nama, orang, dan kreator", () => {
  assert.equal(
    saringRiwayat(daftar, bacaSaringanRiwayat({ cari: "SMP-0007" })).length,
    1,
  );
  assert.equal(
    saringRiwayat(daftar, bacaSaringanRiwayat({ cari: "lampu" })).length,
    1,
  );
  assert.equal(
    saringRiwayat(daftar, bacaSaringanRiwayat({ cari: "rian" })).length,
    3,
  );
  assert.equal(
    saringRiwayat(daftar, bacaSaringanRiwayat({ cari: "dinda" })).length,
    1,
  );
});

test("saringan unit dan status bekerja bersama", () => {
  const s = bacaSaringanRiwayat({ unit: "MCN", status: "hilang" });
  assert.equal(saringRiwayat(daftar, s).length, 1);

  const kosong = bacaSaringanRiwayat({ unit: "MCN", status: "dikirim" });
  assert.equal(saringRiwayat(daftar, kosong).length, 0);
});

const scan = (
  kode: string,
  dikenali: boolean,
  pada: string,
  olehNama: string | null = "Nabila Putri",
): BarisScan => ({
  id: `${kode}-${pada}`,
  kode,
  dikenali,
  pada,
  olehNama,
  sampelNama: dikenali ? "Serum Vitamin C" : null,
  berlanjut: false,
});

const pemindaian: BarisScan[] = [
  scan("SMP-0001", true, "2024-10-24T09:00:00Z"),
  scan("SMP-LAMA-114", false, "2024-10-23T09:00:00Z"),
  scan("SMP-0007", true, "2024-10-20T09:00:00Z", "Rizky Ananda"),
];

test("saringan kode asing hanya menyisakan yang tak dikenali", () => {
  const hasil = saringScan(pemindaian, {
    ...bacaSaringanScan({}),
    jenis: "asing",
  });
  assert.deepEqual(
    hasil.map((s) => s.kode),
    ["SMP-LAMA-114"],
  );
});

test("saringan tanggal memakai hari setempat, bukan cap waktu penuh", () => {
  const hasil = saringScan(pemindaian, {
    ...bacaSaringanScan({}),
    dari: "2024-10-23",
    sampai: "2024-10-24",
  });
  assert.equal(hasil.length, 2);
});

test("pencarian pemindaian mencakup kode, barang, dan pemindainya", () => {
  const cari = (kata: string) =>
    saringScan(pemindaian, { ...bacaSaringanScan({}), cari: kata }).map(
      (s) => s.kode,
    );

  assert.deepEqual(cari("lama"), ["SMP-LAMA-114"]);
  assert.deepEqual(cari("rizky"), ["SMP-0007"]);
  assert.deepEqual(cari("serum"), ["SMP-0001", "SMP-0007"]);
});

test("parameter scan_ terbaca sendiri, tidak tercampur saringan perpindahan", () => {
  const dibaca = bacaSaringanScan({
    scan_jenis: "dikenali",
    scan_dari: "2024-10-01",
  });
  assert.equal(dibaca.jenis, "dikenali");
  assert.equal(dibaca.dari, "2024-10-01");
  assert.equal(scanTersaring(dibaca), true);
  assert.equal(scanTersaring(bacaSaringanScan({})), false);

  // Nilai yang tidak berbentuk tanggal diabaikan, bukan diteruskan.
  assert.equal(bacaSaringanScan({ scan_dari: "kemarin" }).dari, "");
  assert.equal(bacaSaringanScan({ scan_jenis: "apa-saja" }).jenis, "semua");
});
