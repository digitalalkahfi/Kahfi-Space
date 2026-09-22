import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  AMBANG_SERUPA,
  kemiripanJudul,
  masukanSerupa,
  type Masukan,
} from "../masukan.ts";

const m = (judul: string, status: Masukan["status"] = "baru"): Masukan => ({
  id: judul,
  jenis: "bug",
  judul,
  isi: "",
  keparahan: "sedang",
  halaman: "",
  status,
  alasanTolak: "",
  pelaporId: "p1",
  pelaporNama: "A",
  ditugaskanId: null,
  ditugaskanNama: null,
  dukungan: 0,
  sayaDukung: false,
  komentar: [],
  jejak: [],
  dibuatPada: "2024-10-20T09:00:00Z",
});

test("judul yang menyebut hal sama dianggap mirip", () => {
  const nilai = kemiripanJudul(
    "Tombol simpan laporan tidak merespons",
    "Tombol simpan laporan gagal diklik",
  );
  assert.ok(
    nilai >= AMBANG_SERUPA,
    `kemiripan ${nilai} seharusnya cukup tinggi`,
  );
});

test("kata sambung yang sama tidak mengarang kemiripan", () => {
  const nilai = kemiripanJudul(
    "Tidak bisa masuk dengan akun kerja",
    "Tidak bisa mengunduh rekap absensi",
  );
  assert.ok(nilai < AMBANG_SERUPA, `kemiripan ${nilai} seharusnya rendah`);
});

test("judul kosong tidak mirip dengan apa pun", () => {
  assert.equal(kemiripanJudul("", "Tombol simpan gagal"), 0);
  assert.equal(kemiripanJudul("di ke dan", "Tombol simpan gagal"), 0);
});

test("laporan serupa diurutkan dari yang paling mirip", () => {
  const hasil = masukanSerupa("Tombol simpan laporan harian tidak merespons", [
    m("Tombol simpan laporan harian gagal"),
    m("Warna grafik GRD sulit dibaca"),
    m("Tombol simpan laporan tidak merespons di HP"),
  ]);

  assert.equal(hasil.length, 2);
  assert.ok(hasil[0].kemiripan >= hasil[1].kemiripan);
});

test("laporan yang sudah selesai atau ditolak tidak ditawarkan", () => {
  // Menyarankan mendukung laporan yang sudah ditutup hanya menyesatkan.
  const hasil = masukanSerupa("Tombol simpan laporan tidak merespons", [
    m("Tombol simpan laporan tidak merespons", "selesai"),
    m("Tombol simpan laporan tidak merespons", "ditolak"),
  ]);
  assert.equal(hasil.length, 0);
});
