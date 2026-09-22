import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bacaSaringanMasukan,
  izinMasukan,
  masukanTersaring,
  ringkasKirimanSaya,
  ringkasMasukan,
  saringMasukan,
  skorPrioritas,
  terbuka,
  urutkanMasukan,
  type Masukan,
} from "../masukan.ts";

const m = (b: Partial<Masukan>): Masukan => ({
  id: Math.random().toString(36),
  jenis: "saran",
  judul: "Uji masukan yang cukup panjang",
  isi: "",
  keparahan: null,
  halaman: "",
  status: "baru",
  alasanTolak: "",
  pelaporId: "p1",
  pelaporNama: "A",
  ditugaskanId: null,
  ditugaskanNama: null,
  dukungan: 0,
  sayaDukung: false,
  komentar: [],
  jejak: [],
  dibuatPada: "2024-10-20T10:00:00Z",
  ...b,
});

test("masukan yang selesai atau ditolak tidak lagi terbuka", () => {
  assert.equal(terbuka(m({ status: "baru" })), true);
  assert.equal(terbuka(m({ status: "dikerjakan" })), true);
  assert.equal(terbuka(m({ status: "selesai" })), false);
  assert.equal(terbuka(m({ status: "ditolak" })), false);
});

test("bug kritis mengalahkan saran sepopuler apa pun", () => {
  // Banyaknya peminat tidak mengubah fakta bahwa ada yang rusak.
  const bug = m({ jenis: "bug", keparahan: "kritis", dukungan: 0 });
  const saran = m({ dukungan: 30 });
  assert.equal(skorPrioritas(bug) > skorPrioritas(saran), true);
});

test("di antara yang setara, dukungan menentukan", () => {
  const a = m({ jenis: "bug", keparahan: "sedang", dukungan: 5 });
  const b = m({ jenis: "bug", keparahan: "sedang", dukungan: 1 });
  assert.equal(skorPrioritas(a) > skorPrioritas(b), true);
});

test("yang sudah tuntas turun ke bawah walau skornya tinggi", () => {
  const hasil = urutkanMasukan([
    m({ id: "selesai", jenis: "bug", keparahan: "kritis", status: "selesai" }),
    m({ id: "terbuka", dukungan: 1 }),
  ]);
  assert.deepEqual(
    hasil.map((x) => x.id),
    ["terbuka", "selesai"],
  );
});

test("ringkasan menghitung bug terbuka dan yang kritis", () => {
  const r = ringkasMasukan([
    m({ jenis: "bug", keparahan: "kritis", status: "dikerjakan" }),
    m({ jenis: "bug", keparahan: "ringan", status: "baru" }),
    m({ jenis: "bug", keparahan: "kritis", status: "selesai" }),
    m({ status: "baru" }),
  ]);
  assert.equal(r.total, 4);
  assert.equal(r.baru, 2);
  assert.equal(r.bugTerbuka, 2);
  assert.equal(r.bugKritis, 1);
});

test("ringkasan kiriman sendiri memisahkan menunggu dari ditindaklanjuti", () => {
  const r = ringkasKirimanSaya([
    m({ status: "baru" }),
    m({ status: "ditinjau" }),
    m({ status: "dikerjakan", dukungan: 3 }),
    m({ status: "selesai", dukungan: 2 }),
    m({ status: "ditolak" }),
  ]);
  assert.equal(r.total, 5);
  assert.equal(r.menunggu, 2);
  assert.equal(r.ditindaklanjuti, 1);
  assert.equal(r.selesai, 1);
  assert.equal(r.ditolak, 1);
  assert.equal(r.dukunganDiterima, 5);
});

test("tanpa kiriman seluruh hitungannya nol", () => {
  const r = ringkasKirimanSaya([]);
  assert.equal(r.total, 0);
  assert.equal(r.dukunganDiterima, 0);
});

test("saringan jenis dan keparahan bekerja bersama", () => {
  const daftar = [
    m({ jenis: "bug", keparahan: "kritis" }),
    m({ jenis: "bug", keparahan: "ringan" }),
    m({ jenis: "saran" }),
  ];
  const s = bacaSaringanMasukan({ jenis: "bug", keparahan: "kritis" });
  assert.equal(saringMasukan(daftar, s).length, 1);
});

test("saringan 'terbuka' mencakup semua yang belum tuntas", () => {
  // Yang paling sering dicari bukan satu status, melainkan yang belum selesai.
  const daftar = [
    m({ status: "baru" }),
    m({ status: "dikerjakan" }),
    m({ status: "selesai" }),
    m({ status: "ditolak" }),
  ];
  const s = bacaSaringanMasukan({ status: "terbuka" });
  assert.equal(saringMasukan(daftar, s).length, 2);
});

test("nilai saringan yang tidak dikenal diabaikan", () => {
  const s = bacaSaringanMasukan({
    jenis: "keluhan",
    status: "entah",
    keparahan: "maut",
  });
  assert.equal(s.jenis, "semua");
  assert.equal(s.status, "semua");
  assert.equal(s.keparahan, "semua");
  assert.equal(masukanTersaring(s), false);
});

test("pencarian mencakup judul, isi, pelapor, dan halaman", () => {
  const daftar = [
    m({ judul: "Absensi selfie gagal terbuka", halaman: "/absensi" }),
    m({
      judul: "Pengingat laporan harian",
      isi: "sebelum pulang",
      pelaporNama: "Maya",
    }),
  ];
  assert.equal(
    saringMasukan(daftar, bacaSaringanMasukan({ cari: "selfie" })).length,
    1,
  );
  assert.equal(
    saringMasukan(daftar, bacaSaringanMasukan({ cari: "/absensi" })).length,
    1,
  );
  assert.equal(
    saringMasukan(daftar, bacaSaringanMasukan({ cari: "maya" })).length,
    1,
  );
  assert.equal(
    saringMasukan(daftar, bacaSaringanMasukan({ cari: "pulang" })).length,
    1,
  );
});

test("izin masukan mengikuti peran, kepemilikan, dan statusnya", () => {
  // Cerminan policy 0093; kalau layar dan database bercerita berbeda,
  // tombolnya ada tapi penyimpanannya ditolak.
  const laporan = m({ pelaporId: "p1", ditugaskanId: "p2", status: "baru" });

  const pelapor = izinMasukan("p1", false, laporan);
  assert.equal(pelapor.bolehSunting, true);
  assert.equal(pelapor.bolehGerakkanStatus, false);

  const penanggung = izinMasukan("p2", false, laporan);
  assert.equal(penanggung.bolehSunting, false);
  assert.equal(penanggung.bolehGerakkanStatus, true);

  const orangLain = izinMasukan("p3", false, laporan);
  assert.equal(orangLain.bolehSunting, false);
  assert.equal(orangLain.bolehGerakkanStatus, false);

  const pengelola = izinMasukan("p3", true, laporan);
  assert.equal(pengelola.bolehSunting, true);
  assert.equal(pengelola.bolehGerakkanStatus, true);
});

test("pengirim tidak lagi boleh menyunting setelah laporannya ditinjau", () => {
  const ditinjau = m({
    pelaporId: "p1",
    ditugaskanId: null,
    status: "ditinjau",
  });
  assert.equal(izinMasukan("p1", false, ditinjau).bolehSunting, false);
  assert.equal(izinMasukan("p1", true, ditinjau).bolehSunting, true);
});

test("izin masukan hanya berisi data, tidak membawa fungsi", () => {
  // Nilainya menyeberang dari Server ke Client Component; fungsi di
  // dalamnya akan menggagalkan render dengan galat yang membingungkan.
  const izin = izinMasukan("p1", false, m({ pelaporId: "p1" }));
  for (const [kunci, nilai] of Object.entries(izin)) {
    assert.notEqual(typeof nilai, "function", `${kunci} tidak boleh fungsi`);
  }
});
