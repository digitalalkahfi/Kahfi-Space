import { strict as assert } from "node:assert";
import { test } from "node:test";
import { putusanGerbang } from "@/lib/gerbang-coba";

const gerbang = { batas: 3, jendela: 60_000 };

test("percobaan pertama selalu boleh", () => {
  const { putusan } = putusanGerbang(undefined, 1_000, gerbang);
  assert.equal(putusan.boleh, true);
  assert.equal(putusan.sisa, 2);
  assert.equal(putusan.tungguDetik, 0);
});

test("sisa percobaan berkurang sampai habis", () => {
  let catatan;
  const sisa = [];
  for (let i = 0; i < 3; i++) {
    const hasil = putusanGerbang(catatan, 1_000, gerbang);
    catatan = hasil.berikutnya;
    sisa.push(hasil.putusan.sisa);
  }
  assert.deepEqual(sisa, [2, 1, 0]);
});

test("percobaan keempat ditolak dengan waktu tunggu", () => {
  let catatan;
  for (let i = 0; i < 3; i++) {
    catatan = putusanGerbang(catatan, 1_000, gerbang).berikutnya;
  }
  const { putusan } = putusanGerbang(catatan, 11_000, gerbang);
  assert.equal(putusan.boleh, false);
  assert.equal(putusan.sisa, 0);
  // Jendela 60 detik, sudah lewat 10 → sisa 50.
  assert.equal(putusan.tungguDetik, 50);
});

test("menggedor saat tertutup tidak memperpanjang jendelanya", () => {
  // Kalau setiap percobaan yang ditolak ikut menambah hitungan, orang
  // yang menunggu dengan sabar tidak akan pernah bisa masuk lagi.
  let catatan;
  for (let i = 0; i < 3; i++) {
    catatan = putusanGerbang(catatan, 0, gerbang).berikutnya;
  }
  for (const t of [1_000, 2_000, 30_000]) {
    catatan = putusanGerbang(catatan, t, gerbang).berikutnya;
  }
  assert.equal(catatan?.jumlah, 3, "hitungan tidak boleh melewati batas");
  assert.equal(catatan?.mulai, 0, "jendela tidak boleh bergeser");
});

test("jendela baru dimulai setelah jendela lama lewat", () => {
  let catatan;
  for (let i = 0; i < 3; i++) {
    catatan = putusanGerbang(catatan, 0, gerbang).berikutnya;
  }
  const { putusan } = putusanGerbang(catatan, 60_000, gerbang);
  assert.equal(putusan.boleh, true);
  assert.equal(putusan.sisa, 2);
});

test("dua kunci berbeda tidak saling menghabiskan jatah", () => {
  // Diperiksa lewat catatan terpisah: fungsi murni ini tidak tahu kunci,
  // dan itulah yang membuat pemanggilnya bebas memisahkan per akun.
  const a = putusanGerbang(undefined, 0, gerbang);
  const b = putusanGerbang(undefined, 0, gerbang);
  assert.equal(a.putusan.sisa, 2);
  assert.equal(b.putusan.sisa, 2);
});
