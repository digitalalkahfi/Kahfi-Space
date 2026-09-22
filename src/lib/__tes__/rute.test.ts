import { strict as assert } from "node:assert";
import { test } from "node:test";
import { jalurAman } from "../rute.ts";

test("jalur internal diteruskan apa adanya", () => {
  assert.equal(jalurAman("/grd/scorecard"), "/grd/scorecard");
  assert.equal(jalurAman("/tugas?saring=qc"), "/tugas?saring=qc");
});

test("kosong jatuh ke beranda", () => {
  assert.equal(jalurAman(""), "/beranda");
  assert.equal(jalurAman(null), "/beranda");
  assert.equal(jalurAman(undefined), "/beranda");
});

test("alamat luar ditolak", () => {
  // Semua bentuk ini akan membawa pengguna keluar aplikasi tepat setelah
  // ia memasukkan kata sandi.
  assert.equal(jalurAman("https://situs-palsu.test"), "/beranda");
  assert.equal(jalurAman("//situs-palsu.test"), "/beranda");
  assert.equal(jalurAman("/\\situs-palsu.test"), "/beranda");
  assert.equal(jalurAman("javascript:alert(1)"), "/beranda");
});
