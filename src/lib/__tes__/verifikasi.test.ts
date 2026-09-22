import { strict as assert } from "node:assert";
import { test } from "node:test";
import { nilaiBaris, type BarisVerifikasi } from "../migrasi.ts";

const baris = (b: Partial<BarisVerifikasi>): BarisVerifikasi => ({
  entitas: "report",
  label: "Laporan harian",
  tabelBaru: "daily_reports",
  sumber: 10,
  berhasil: 10,
  dilewati: 0,
  gagal: 0,
  tujuan: 10,
  ...b,
});

test("belum pernah dijalankan bukan ketidakcocokan", () => {
  const p = nilaiBaris(baris({ berhasil: 0, tujuan: 0 }));
  assert.equal(p.cocok, true);
  assert.match(p.keterangan, /belum pernah dijalankan/);
});

test("semua berpindah utuh dinyatakan cocok", () => {
  const p = nilaiBaris(baris({}));
  assert.equal(p.cocok, true);
  assert.match(p.keterangan, /utuh/);
});

test("entri yang sengaja dilewati tetap dianggap cocok", () => {
  const p = nilaiBaris(baris({ berhasil: 8, dilewati: 2, tujuan: 8 }));
  assert.equal(p.cocok, true);
  assert.match(p.keterangan, /sengaja dilewati/);
});

test("entri yang terlewat sama sekali ditandai", () => {
  // 10 di sumber tapi hanya 7 yang tercatat diperiksa.
  const p = nilaiBaris(baris({ berhasil: 7, tujuan: 7 }));
  assert.equal(p.cocok, false);
  assert.match(p.keterangan, /terlewat sama sekali/);
});

test("berhasil tapi tidak ada di tujuan adalah kehilangan diam-diam", () => {
  const p = nilaiBaris(baris({ berhasil: 10, tujuan: 6 }));
  assert.equal(p.cocok, false);
  assert.match(p.keterangan, /hilang tanpa galat/);
});

test("kegagalan membuat entitas belum dianggap selesai", () => {
  const p = nilaiBaris(baris({ berhasil: 8, gagal: 2, tujuan: 8 }));
  assert.equal(p.cocok, false);
  assert.match(p.keterangan, /belum boleh dianggap selesai/);
});

test("tujuan lebih banyak dari sumber tidak dianggap salah", () => {
  // Tabel tujuan bisa sudah berisi data yang dibuat langsung di aplikasi.
  const p = nilaiBaris(baris({ tujuan: 25 }));
  assert.equal(p.cocok, true);
});
