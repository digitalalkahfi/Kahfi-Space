import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  hariIzin,
  koordinat,
  persetujuanIzin,
  statusHadir,
} from "@/lib/izin-v1";

test("status kehadiran lama dikenali dalam dua bahasa", () => {
  assert.equal(statusHadir("late"), "terlambat");
  assert.equal(statusHadir("TERLAMBAT"), "terlambat");
  assert.equal(statusHadir("sick"), "sakit");
  assert.equal(statusHadir("izin"), "izin");
  // Yang tidak dikenali dianggap hadir: barisnya memang ada, dan
  // menandainya mangkir adalah tuduhan yang tak pernah dimaksudkan.
  assert.equal(statusHadir("checked-in"), "hadir");
  assert.equal(statusHadir(null), "hadir");
});

test("pengajuan yang masih menunggu tetap menunggu", () => {
  assert.equal(persetujuanIzin("approved"), "disetujui");
  assert.equal(persetujuanIzin("ditolak"), "ditolak");
  assert.equal(persetujuanIzin("pending"), "diajukan");
  assert.equal(persetujuanIzin(undefined), "diajukan");
});

test("izin beberapa hari dibentangkan menjadi satu baris per hari", () => {
  assert.deepEqual(hariIzin("2024-10-01", "2024-10-03"), [
    "2024-10-01",
    "2024-10-02",
    "2024-10-03",
  ]);
  assert.deepEqual(hariIzin("2024-10-01", "2024-10-01"), ["2024-10-01"]);
});

test("rentang terbalik tidak menghasilkan ribuan hari", () => {
  // Data lama sesekali menaruh tanggal selesai sebelum tanggal mulai.
  assert.deepEqual(hariIzin("2024-10-05", "2024-10-01"), ["2024-10-05"]);
});

test("rentang yang keterlaluan dipotong pada batasnya", () => {
  const hari = hariIzin("2024-01-01", "2025-01-01");
  assert.equal(hari.length, 62);
  assert.equal(hari[0], "2024-01-01");
});

test("tanggal yang tidak sah menghasilkan daftar kosong", () => {
  assert.deepEqual(hariIzin("kemarin", "2024-10-01"), []);
});

test("izin melewati pergantian bulan tetap utuh", () => {
  const hari = hariIzin("2024-10-30", "2024-11-02");
  assert.deepEqual(hari, [
    "2024-10-30",
    "2024-10-31",
    "2024-11-01",
    "2024-11-02",
  ]);
});

test("koordinat dibaca hanya bila bentuknya masuk akal", () => {
  assert.deepEqual(koordinat({ lat: -6.2, lng: 106.8 }), {
    lat: -6.2,
    lng: 106.8,
  });
  assert.deepEqual(koordinat({ lat: "-6.2" }), { lat: null, lng: null });
  assert.deepEqual(koordinat(null), { lat: null, lng: null });
});
