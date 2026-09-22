import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bagiSumbu,
  labelSumbuX,
  puncakRapi,
  skalaGrafik,
  teksSatuan,
} from "@/lib/grafik";

const deret = (...nilai: number[]) =>
  nilai.map((n, i) => ({ label: `t${i}`, nilai: n }));

test("puncakRapi membulatkan ke angka yang enak dibaca", () => {
  assert.equal(puncakRapi(34_170_000), 40_000_000);
  assert.equal(puncakRapi(22_800_000), 25_000_000);
  assert.equal(puncakRapi(9_100), 10_000);
  assert.equal(puncakRapi(100), 100, "yang sudah bulat tidak dinaikkan");
});

test("puncakRapi tidak pernah mengembalikan nol atau NaN", () => {
  // Sumbu setinggi nol berarti pembagian nol saat menghitung posisi
  // titik; periode kosong harus tetap menghasilkan bingkai yang sah.
  assert.equal(puncakRapi(0), 1);
  assert.equal(puncakRapi(-5), 1);
  assert.equal(puncakRapi(Number.NaN), 1);
});

test("skalaGrafik selalu menyertakan nol", () => {
  // Sumbu yang mulai dari nilai terendahnya sendiri membesar-besarkan
  // naik-turun kecil sampai terlihat seperti guncangan.
  const s = skalaGrafik([90, 95, 100]);
  assert.equal(s.min, 0);
  assert.equal(s.max, 100);
  assert.deepEqual(s.tanda, [100, 50, 0]);
});

test("skalaGrafik turun di bawah nol hanya bila ada nilai negatif", () => {
  const s = skalaGrafik([-30, 10, 80]);
  assert.equal(s.max, 80);
  assert.equal(s.min, -30);
  assert.deepEqual(s.tanda, [80, 25, -30]);
});

test("labelSumbuX memberi label semua titik bila muat", () => {
  assert.deepEqual(labelSumbuX(4), [0, 1, 2, 3]);
  assert.deepEqual(labelSumbuX(6), [0, 1, 2, 3, 4, 5]);
});

test("labelSumbuX menjarangkan titik yang terlalu rapat", () => {
  // 31 tanggal berjejer pada lebar ponsel saling menimpa; yang tersisa
  // harus tetap berjarak sama dan mencakup kedua ujungnya.
  const t = labelSumbuX(31);
  assert.ok(t.length <= 6, `dapat ${t.length} label`);
  assert.equal(t[0], 0);
  assert.equal(t.at(-1), 30);
});

test("labelSumbuX tidak menaruh dua label berdempetan di ujung kanan", () => {
  // Panjang 32 dengan langkah 7 berhenti di 28, tiga titik dari ujung —
  // label 28 dan 31 akan saling menimpa, jadi yang 28 mengalah.
  const t = labelSumbuX(32);
  assert.equal(t.at(-1), 31);
  assert.ok(
    31 - t.at(-2)! >= 4,
    `label sebelum ujung terlalu rapat: ${t.join(",")}`,
  );
});

test("labelSumbuX aman untuk seri kosong atau satu titik", () => {
  assert.deepEqual(labelSumbuX(0), []);
  assert.deepEqual(labelSumbuX(1), [0]);
});

test("bagiSumbu tidak pernah menaruh dua satuan pada satu sumbu", () => {
  // Rupiah dan cacah laporan pada satu skala menghasilkan tinggi yang
  // tidak berarti apa pun.
  const sisi = bagiSumbu([
    { satuan: "rupiah", titik: deret(30, 40) },
    { satuan: "angka", titik: deret(7, 8) },
  ]);
  assert.deepEqual(sisi, ["kiri", "kanan"]);
});

test("bagiSumbu membiarkan dua garis sepadan berbagi sumbu", () => {
  // Di sinilah justru informasinya: lini yang dua kali lebih besar
  // harus tergambar dua kali lebih tinggi.
  const sisi = bagiSumbu([
    { satuan: "rupiah", titik: deret(100, 120) },
    { satuan: "rupiah", titik: deret(50, 60) },
  ]);
  assert.deepEqual(sisi, ["kiri", "kiri"]);
});

test("bagiSumbu memberi sumbu sendiri saat garis kecil tidak terbaca", () => {
  const sisi = bagiSumbu([
    { satuan: "rupiah", titik: deret(100, 120) },
    { satuan: "rupiah", titik: deret(5, 8) },
  ]);
  assert.deepEqual(sisi, ["kiri", "kanan"]);
});

test("bagiSumbu menyatukan tiga garis sesatuan pada satu sumbu", () => {
  // Tiga skala berbeda berarti tidak ada lagi yang bisa dibandingkan.
  const sisi = bagiSumbu([
    { satuan: "rupiah", titik: deret(100, 120) },
    { satuan: "rupiah", titik: deret(50, 60) },
    { satuan: "rupiah", titik: deret(2, 3) },
  ]);
  assert.deepEqual(sisi, ["kiri", "kiri", "kiri"]);
});

test("bagiSumbu aman untuk daftar kosong", () => {
  assert.deepEqual(bagiSumbu([]), []);
});

test("teksSatuan memakai format sesuai satuannya", () => {
  assert.equal(teksSatuan(34_200_000, "rupiah"), "Rp 34,2 Jt");
  assert.equal(teksSatuan(34_200_000, "rupiah", { prefix: false }), "34,2 Jt");
  assert.equal(teksSatuan(342_163, "angka"), "342.163");
  assert.equal(teksSatuan(91.2, "persen"), "91,2%");
});
