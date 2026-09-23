import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  pohonStruktur,
  ratakanStruktur,
  tercecer,
  type SimpulStruktur,
} from "@/lib/struktur";
import { DAFTAR_UNIT, kodeUnitSah, UNIT_PELAPORAN } from "@/lib/unit-pelaporan";
import type { AnggotaTim, Peran } from "@/lib/types";

const orang = (
  id: string,
  nama: string,
  atasanId: string | null,
  role: Peran = "Staff",
  status: "aktif" | "nonaktif" = "aktif",
): AnggotaTim => ({
  id,
  nama,
  email: `${id}@contoh.id`,
  role,
  jabatan: `${role} ${nama}`,
  unitKode: null,
  unitNama: "—",
  departemenId: null,
  departemen: null,
  programId: null,
  program: null,
  atasanId,
  atasanNama: null,
  inisial: nama.slice(0, 2).toUpperCase(),
  status,
  akunDipegang: 0,
});

const nama = (pohon: SimpulStruktur[]) =>
  ratakanStruktur(pohon).map((s) => s.nama);

test("yang tanpa atasan menjadi akar, bawahannya menggantung di bawahnya", () => {
  const pohon = pohonStruktur([
    orang("c", "Citra", "a"),
    orang("a", "Adi", null, "CEO"),
    orang("b", "Budi", "a", "Manager"),
  ]);

  assert.equal(pohon.length, 1);
  assert.equal(pohon[0].nama, "Adi");
  assert.deepEqual(
    pohon[0].bawahan.map((b) => b.nama),
    ["Budi", "Citra"],
    "bawahan langsung urut abjad",
  );
});

test("jumlah bawahan menghitung seluruh tingkat di bawahnya", () => {
  const pohon = pohonStruktur([
    orang("a", "Adi", null, "CEO"),
    orang("b", "Budi", "a", "Manager"),
    orang("c", "Citra", "b", "Leader"),
    orang("d", "Dewi", "c"),
  ]);

  assert.equal(pohon[0].jumlahBawahan, 3, "Adi membawahi semuanya");
  assert.equal(pohon[0].bawahan[0].jumlahBawahan, 2);
  assert.equal(pohon[0].bawahan[0].bawahan[0].jumlahBawahan, 1);
});

test("tingkat naik satu per satu dari akarnya", () => {
  const pohon = pohonStruktur([
    orang("a", "Adi", null),
    orang("b", "Budi", "a"),
    orang("c", "Citra", "b"),
  ]);

  assert.deepEqual(
    ratakanStruktur(pohon).map((s) => [s.nama, s.tingkat]),
    [
      ["Adi", 0],
      ["Budi", 1],
      ["Citra", 2],
    ],
  );
});

test("yang nonaktif tidak ikut, dan bawahannya naik jadi akar", () => {
  // Susunan organisasi menjawab keadaan sekarang. Orang yang atasannya
  // sudah keluar memang menggantung, dan itu yang perlu terlihat.
  const pohon = pohonStruktur([
    orang("a", "Adi", null, "CEO", "nonaktif"),
    orang("b", "Budi", "a"),
  ]);

  assert.deepEqual(nama(pohon), ["Budi"]);
  assert.equal(pohon[0].tingkat, 0);
});

test("atasan yang tidak ada di daftar dianggap tidak ada", () => {
  // Bisa terjadi saat daftarnya disaring RLS: atasannya nyata, tapi
  // tidak terlihat oleh pembacanya.
  const pohon = pohonStruktur([orang("b", "Budi", "entah")]);
  assert.deepEqual(nama(pohon), ["Budi"]);
});

test("data yang berputar tidak membuat pohonnya tak berujung", () => {
  // Database menolak siklus, tapi tampilan tidak boleh bergantung
  // pada itu: yang penting halaman tetap selesai digambar.
  const pohon = pohonStruktur([
    orang("a", "Adi", "b"),
    orang("b", "Budi", "a"),
  ]);

  assert.equal(ratakanStruktur(pohon).length <= 2, true);
});

test("akar diurutkan abjad, bukan urutan masuknya", () => {
  const pohon = pohonStruktur([
    orang("z", "Zaki", null),
    orang("a", "Adi", null),
  ]);
  assert.deepEqual(
    pohon.map((s) => s.nama),
    ["Adi", "Zaki"],
  );
});

test("tanpa anggota aktif, pohonnya kosong", () => {
  assert.deepEqual(pohonStruktur([]), []);
  assert.deepEqual(
    pohonStruktur([orang("a", "Adi", null, "CEO", "nonaktif")]),
    [],
  );
});

test("kedalaman dibatasi supaya rantai panjang tidak menggantung layar", () => {
  const panjang = Array.from({ length: 30 }, (_, i) =>
    orang(`o${i}`, `Orang ${i}`, i === 0 ? null : `o${i - 1}`),
  );
  const pohon = pohonStruktur(panjang, 5);

  const tingkatMaks = Math.max(...ratakanStruktur(pohon).map((s) => s.tingkat));
  assert.equal(tingkatMaks, 5);
});

test("yang tidak masuk pohon dilaporkan, bukan dihilangkan", () => {
  const semua = [
    orang("a", "Adi", null),
    orang("b", "Budi", "c"),
    orang("c", "Citra", "b"),
  ];
  const pohon = pohonStruktur(semua, 0);
  const lepas = tercecer(semua, pohon);

  assert.equal(
    lepas.length + ratakanStruktur(pohon).length,
    semua.length,
    "semua orang terhitung, entah di pohon atau di daftar tercecer",
  );
});

test("kode unit yang sah hanya tiga, sisanya ditolak", () => {
  // Dipakai memeriksa parameter route `/tim/unit/[kode]`: kode yang
  // tidak dikenal harus jatuh ke 404, bukan ke halaman kosong.
  for (const kode of ["affiliator", "mcn", "tap"]) {
    assert.equal(kodeUnitSah(kode), true, kode);
  }
  for (const salah of ["Affiliator", "keuangan", "", null, 3, undefined]) {
    assert.equal(kodeUnitSah(salah), false, String(salah));
  }
});

test("tiap unit menyebut cara pelaporannya", () => {
  // Perbedaan inilah yang menentukan siapa wajib mengisi laporan
  // harian; kalau hilang, halaman unitnya kehilangan isinya.
  assert.equal(UNIT_PELAPORAN.affiliator.lapor, "akun");
  assert.equal(UNIT_PELAPORAN.mcn.lapor, "unit");
  assert.equal(UNIT_PELAPORAN.tap.lapor, "unit");

  // Hanya Affiliator yang punya kolom di luar GMV.
  assert.ok(UNIT_PELAPORAN.affiliator.kolomTambahan.length > 0);
  assert.deepEqual(UNIT_PELAPORAN.mcn.kolomTambahan, []);
  assert.deepEqual(UNIT_PELAPORAN.tap.kolomTambahan, []);
});

test("daftar unit memuat ketiganya tanpa duplikat", () => {
  assert.deepEqual(
    DAFTAR_UNIT.map((u) => u.kode),
    ["affiliator", "mcn", "tap"],
  );
});
