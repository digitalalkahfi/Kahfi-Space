import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bolehKelolaPeran,
  DAFTAR_PERAN,
  hakPeran,
  HAK_AKSES,
  matriksHakAkses,
} from "@/lib/hak-akses";
import { bolehLihat } from "@/lib/akses";
import { bolehLihatKeuangan } from "@/lib/keuangan";

test("matriks memuat seluruh peran pada tiap barisnya", () => {
  const matriks = matriksHakAkses();
  assert.equal(matriks.length, HAK_AKSES.length);

  for (const baris of matriks) {
    assert.deepEqual(Object.keys(baris.per).sort(), [...DAFTAR_PERAN].sort());
  }
});

test("matriks tidak mengarang: tiap sel sama dengan aturan aslinya", () => {
  // Inilah gunanya matriks ini dihitung, bukan diketik: kalau suatu
  // saat aturan aslinya berubah, tabelnya ikut berubah sendiri.
  const matriks = matriksHakAkses();
  const keuangan = matriks.find((b) => b.kunci === "angkaPerusahaan");
  const kehadiran = matriks.find((b) => b.kunci === "pantauKehadiran");

  for (const peran of DAFTAR_PERAN) {
    assert.equal(keuangan?.per[peran], bolehLihatKeuangan(peran), peran);
    assert.equal(
      kehadiran?.per[peran],
      bolehLihat(peran, "pantauKehadiran"),
      peran,
    );
  }
});

test("hanya CEO dan Manager yang menyetel peran orang lain", () => {
  assert.equal(bolehKelolaPeran("CEO"), true);
  assert.equal(bolehKelolaPeran("Manager"), true);
  for (const peran of ["Leader", "Co-Leader", "Staff", "Finance"] as const) {
    assert.equal(bolehKelolaPeran(peran), false, peran);
  }
});

test("Finance memantau angka, bukan kehadiran operasional", () => {
  const punya = hakPeran("Finance");
  assert.ok(punya.includes("Membuka modul Keuangan"));
  assert.ok(!punya.includes("Memantau kehadiran orang lain"));
});

test("Staff tidak memegang satu pun hak pengelolaan", () => {
  const punya = hakPeran("Staff");
  assert.ok(!punya.includes("Mengubah data anggota & perannya"));
  assert.ok(!punya.includes("Mengubah akun, PIC, dan levelnya"));
  assert.ok(!punya.includes("Membuka modul Keuangan"));
  // Tapi ia tetap melihat capaiannya sendiri.
  assert.ok(punya.includes("Melihat kartu capaian pribadi"));
});

test("CEO memegang setiap kemampuan yang didaftarkan", () => {
  assert.equal(hakPeran("CEO").length, HAK_AKSES.length - 1);
  // Kecuali satu: kartu capaian pribadi memang bukan untuk jajaran
  // yang tidak punya sasaran laporan sendiri.
  assert.ok(!hakPeran("CEO").includes("Melihat kartu capaian pribadi"));
});

test("tiap baris menyebut alasannya, bukan hanya boleh atau tidak", () => {
  for (const baris of HAK_AKSES) {
    assert.ok(baris.alasan.length > 20, `${baris.kunci} perlu alasan`);
    assert.ok(baris.label.length > 0);
  }
});
