import { strict as assert } from "node:assert";
import { test } from "node:test";
import { bolehLihat, widgetPerPeran } from "../akses.ts";
import { URUTAN_PERAN } from "../peran.ts";
import { bolehLihatKeuangan } from "../keuangan.ts";

test("setiap peran punya daftar widget Beranda", () => {
  for (const peran of URUTAN_PERAN) {
    assert.ok(
      widgetPerPeran[peran].length > 0,
      `${peran} tidak boleh berakhir dengan Beranda kosong`,
    );
  }
});

test("agenda bersama terlihat semua peran", () => {
  // Kalender memang milik semua orang; menyembunyikannya dari sebagian
  // peran membuat rapat yang sama diumumkan ulang lewat jalur lain.
  for (const peran of URUTAN_PERAN) {
    assert.equal(bolehLihat(peran, "agenda"), true, `${peran} perlu agenda`);
  }
});

test("kehadiran orang lain tidak terbuka untuk Staff dan Finance", () => {
  // Staff hanya melihat capaian unitnya; Finance memantau angka, bukan
  // kehadiran operasional harian.
  assert.equal(bolehLihat("Staff", "pantauKehadiran"), false);
  assert.equal(bolehLihat("Finance", "pantauKehadiran"), false);
  assert.equal(bolehLihat("Manager", "pantauKehadiran"), true);
});

test("tidak ada widget yang terdaftar dua kali", () => {
  for (const peran of URUTAN_PERAN) {
    const daftar = widgetPerPeran[peran];
    assert.equal(
      new Set(daftar).size,
      daftar.length,
      `${peran} punya widget kembar`,
    );
  }
});

test("posisi kas hanya untuk yang memegang angka perusahaan", () => {
  for (const peran of ["CEO", "Manager", "Finance"] as const) {
    assert.equal(bolehLihat(peran, "posisiKas"), true, peran);
  }
  for (const peran of ["Leader", "Co-Leader", "Staff"] as const) {
    assert.equal(bolehLihat(peran, "posisiKas"), false, peran);
  }
});

test("daftar widget Beranda sejalan dengan izin modul Keuangan", () => {
  // Kartu kas di Beranda tidak boleh muncul untuk peran yang halaman
  // Keuangannya sendiri tertutup.
  for (const peran of URUTAN_PERAN) {
    assert.equal(
      bolehLihat(peran, "posisiKas"),
      bolehLihatKeuangan(peran),
      `${peran} harus konsisten antara Beranda dan halaman Keuangan`,
    );
  }
});
