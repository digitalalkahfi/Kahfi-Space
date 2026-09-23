import { strict as assert } from "node:assert";
import { test } from "node:test";
import { catatanLaporan } from "@/lib/laporan-v1";

test("medan bebas digabung, medan berkolom sendiri tidak diulang", () => {
  const teks = catatanLaporan({
    id: "rep_1",
    userId: "usr_1",
    "Tanggal Laporan": "2024-10-01",
    Akun: "@a",
    GMV: "1.000",
    Komisi: "10",
    "Jumlah Upload": 3,
    Kendala: "Sinyal mati",
    "Rencana Besok": "Live pagi",
  });

  assert.equal(teks, "Sinyal mati\nRencana Besok: Live pagi");
});

test("medan target dibuang, bukan ikut ke catatan", () => {
  // Target bukan jawaban orang; menyimpannya membuat catatan penuh
  // angka yang menyesatkan saat dibaca ulang.
  const teks = catatanLaporan({
    "Target GMV": "5.000.000",
    "Target Upload": 10,
    Kendala: "Aman",
  });
  assert.equal(teks, "Aman");
});

test("nilai kosong tidak menyisakan baris hampa", () => {
  const teks = catatanLaporan({ Kendala: "", Catatan: null, Lain: undefined });
  assert.equal(teks, "");
});

test("nilai bersarang tetap terbaca, bukan menjadi [object Object]", () => {
  const teks = catatanLaporan({ Lampiran: { url: "a", ukuran: 10 } });
  assert.equal(teks, 'Lampiran: {"url":"a","ukuran":10}');
});

test("seluruh medan berawalan Target dibuang, bukan hanya Target GMV", () => {
  // Pertanyaan target di formulir lama berubah dari waktu ke waktu;
  // membuang satu nama saja berarti sisanya masuk sebagai realisasi.
  const teks = catatanLaporan({
    "Target GMV": "5.000.000",
    "Target Upload": 10,
    "Target Komisi": "500.000",
    "Target Harian Tim": "1.000.000",
    Kendala: "Aman",
  });
  assert.equal(teks, "Aman");
});

test("medan yang kebetulan memuat kata target tetap ikut", () => {
  // "Target" di tengah kalimat adalah jawaban orang, bukan angka target.
  const teks = catatanLaporan({ "Catatan Target Tim": "belum dibahas" });
  assert.equal(teks, "Catatan Target Tim: belum dibahas");
});

test("catatan dipotong supaya tidak melampaui kolomnya", () => {
  const panjang = "x".repeat(5000);
  const teks = catatanLaporan({ Kendala: panjang });
  assert.equal(teks.length <= 2000, true);
});
