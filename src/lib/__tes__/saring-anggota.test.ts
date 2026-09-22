import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bacaSaringan,
  saringAnggota,
  saringanAktif,
} from "../saring-anggota.ts";
import type { AnggotaTim } from "../types.ts";

const orang = (
  nama: string,
  role: AnggotaTim["role"],
  unitNama: string,
  status: AnggotaTim["status"] = "aktif",
  jabatan = `${role} ${unitNama}`,
  email = `${nama.split(" ")[0].toLowerCase()}@alkahfi.co.id`,
): AnggotaTim => ({
  id: nama,
  nama,
  email,
  role,
  jabatan,
  unitKode: null,
  unitNama,
  departemenId: null,
  departemen: null,
  programId: null,
  program: null,
  atasanId: null,
  atasanNama: null,
  inisial: "XX",
  status,
  akunDipegang: 0,
});

const daftar: AnggotaTim[] = [
  orang("Anisa Larasati", "Staff", "Affiliator Network"),
  orang("Dewi Lestari", "Leader", "Affiliator Network"),
  orang("Rizky Ananda", "Staff", "MCN"),
  orang("Teguh Wibowo", "Staff", "Affiliator Network", "nonaktif"),
];

test("tanpa saringan seluruh daftar lolos", () => {
  const s = bacaSaringan({});
  assert.equal(saringanAktif(s), false);
  assert.equal(saringAnggota(daftar, s).length, 4);
});

test("pencarian mencakup nama, jabatan, dan email", () => {
  const nama = saringAnggota(daftar, bacaSaringan({ cari: "dewi" }));
  assert.deepEqual(
    nama.map((a) => a.nama),
    ["Dewi Lestari"],
  );

  const jabatan = saringAnggota(daftar, bacaSaringan({ cari: "leader" }));
  assert.deepEqual(
    jabatan.map((a) => a.nama),
    ["Dewi Lestari"],
  );

  const email = saringAnggota(daftar, bacaSaringan({ cari: "rizky@" }));
  assert.deepEqual(
    email.map((a) => a.nama),
    ["Rizky Ananda"],
  );
});

test("pencarian tidak peka huruf besar-kecil", () => {
  assert.equal(
    saringAnggota(daftar, bacaSaringan({ cari: "ANISA" })).length,
    1,
  );
});

test("saringan peran, unit, dan status bekerja bersama", () => {
  const s = bacaSaringan({
    peran: "Staff",
    unit: "Affiliator Network",
    status: "aktif",
  });
  assert.deepEqual(
    saringAnggota(daftar, s).map((a) => a.nama),
    ["Anisa Larasati"],
  );
});

test("nilai parameter yang tidak dikenal diabaikan", () => {
  // URL bisa diisi siapa saja; nilai asing tidak boleh menyaring apa pun.
  const s = bacaSaringan({ peran: "Sultan", status: "entah" });
  assert.equal(s.peran, "semua");
  assert.equal(s.status, "semua");
  assert.equal(saringAnggota(daftar, s).length, 4);
});

test("kata kunci dipangkas agar tidak kebablasan", () => {
  const s = bacaSaringan({ cari: "  a".padEnd(200, "b") });
  assert.equal(s.cari.length <= 60, true);
});

const berdepartemen = (
  nama: string,
  departemen: string | null,
  program: string | null,
): AnggotaTim => ({
  ...orang(nama, "Staff", "Affiliator Network"),
  departemen,
  program,
});

const penempatan: AnggotaTim[] = [
  berdepartemen("Salsabila Rahma", "Mabit Scholar", "Mabit Scholar"),
  berdepartemen("Anisa Larasati", "Affiliator", "Reguler"),
  berdepartemen("Rizky Ananda", "MCN", null),
];

test("saringan departemen hanya menyisakan anggota departemen itu", () => {
  const hasil = saringAnggota(penempatan, {
    ...bacaSaringan({}),
    departemen: "Mabit Scholar",
  });
  assert.deepEqual(
    hasil.map((a) => a.nama),
    ["Salsabila Rahma"],
  );
});

test("saringan program tidak ikut membawa yang belum berprogram", () => {
  const hasil = saringAnggota(penempatan, {
    ...bacaSaringan({}),
    program: "Reguler",
  });
  assert.deepEqual(
    hasil.map((a) => a.nama),
    ["Anisa Larasati"],
  );
});

test("saringan penempatan bisa ditumpuk dengan pencarian", () => {
  const hasil = saringAnggota(penempatan, {
    ...bacaSaringan({}),
    departemen: "Affiliator",
    cari: "salsabila",
  });
  assert.equal(hasil.length, 0);
});

test("parameter URL penempatan terbaca dan tercatat sebagai saringan aktif", () => {
  const dibaca = bacaSaringan({ departemen: "MCN", program: "Reguler" });
  assert.equal(dibaca.departemen, "MCN");
  assert.equal(dibaca.program, "Reguler");
  assert.equal(saringanAktif(dibaca), true);
  assert.equal(saringanAktif(bacaSaringan({})), false);
});
