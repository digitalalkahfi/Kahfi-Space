import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  alihkanMenurutStatus,
  pesanGalatGoogle,
  periksaAlasanTolak,
  rapikanNoWa,
  tujuanGalatGoogle,
} from "@/lib/pendaftaran";
import { periksa, periksaAtasan } from "@/lib/validasi-anggota";
import { harusGantiSandiDulu } from "@/lib/keamanan";

test("anggota aktif lewat, kecuali di /menunggu dan /masuk", () => {
  assert.equal(alihkanMenurutStatus("aktif", "/beranda"), null);
  assert.equal(alihkanMenurutStatus("aktif", "/tim/pendaftaran"), null);
  assert.equal(alihkanMenurutStatus("aktif", "/menunggu"), "/beranda");
  assert.equal(alihkanMenurutStatus("aktif", "/masuk"), "/beranda");
});

test("akun yang belum/tidak aktif ditahan di /menunggu (AC2, E6)", () => {
  for (const status of ["menunggu", "ditolak", "nonaktif", "tanpa_profil", null] as const) {
    assert.equal(alihkanMenurutStatus(status, "/beranda"), "/menunggu", String(status));
    assert.equal(alihkanMenurutStatus(status, "/masuk"), "/menunggu");
    assert.equal(alihkanMenurutStatus(status, "/menunggu"), null);
    assert.equal(alihkanMenurutStatus(status, "/auth/callback"), null);
    assert.equal(alihkanMenurutStatus(status, "/api/notifikasi"), null);
  }
});

test("wajib ganti sandi tidak saling lempar dengan /menunggu", () => {
  const meta = { wajib_ganti_sandi: true };
  assert.equal(harusGantiSandiDulu(meta, "/menunggu"), false);
  assert.equal(harusGantiSandiDulu(meta, "/beranda"), true);
});

test("nomor WhatsApp dirapikan ke 62…", () => {
  assert.equal(rapikanNoWa("0812 3456 7890"), "6281234567890");
  assert.equal(rapikanNoWa("+62 812-3456-7890"), "6281234567890");
  assert.equal(rapikanNoWa("6281234567890"), "6281234567890");
  assert.equal(rapikanNoWa("81234567890"), "6281234567890");
  assert.equal(rapikanNoWa("021 555 1234"), null);
  assert.equal(rapikanNoWa("08ab"), null);
  assert.equal(rapikanNoWa("0812"), null);
  assert.equal(rapikanNoWa(""), null);
});

test("BR-07/AC10: alasan tolak wajib, minimal 5 huruf", () => {
  assert.equal(periksaAlasanTolak(""), "Isi alasan penolakan.");
  assert.equal(periksaAlasanTolak("   "), "Isi alasan penolakan.");
  assert.match(periksaAlasanTolak("ab 12") ?? "", /minimal 5 huruf/);
  assert.equal(periksaAlasanTolak("Bukan anggota tim"), null);
});

test("BR-04: persetujuan memakai validasi Tambah anggota", () => {
  const dasar = {
    nama: "Anggota Baru",
    email: "baru@gmail.com",
    role: "Staff" as const,
    jabatan: "Staff Affiliator",
    unitKode: "affiliator" as const,
    departemenId: null,
    programId: null,
    atasanId: "x",
  };
  assert.equal(periksa(dasar), null);
  assert.equal(periksaAtasan(dasar), null);
  assert.match(periksa({ ...dasar, role: "Leader", unitKode: null }) ?? "", /wajib ditempatkan/);
  assert.match(periksaAtasan({ ...dasar, atasanId: null }) ?? "", /atasan langsung/);
  assert.equal(periksaAtasan({ ...dasar, role: "CEO", unitKode: null, atasanId: null }), null);
});

test("galat Google ditampilkan di tempat asal alurnya", () => {
  assert.equal(tujuanGalatGoogle("/profil"), "/profil");
  assert.equal(tujuanGalatGoogle("/beranda"), "/masuk");
  assert.match(pesanGalatGoogle("Identity is already linked to another user"), /sudah tersambung/);
  assert.match(pesanGalatGoogle("Unsupported provider: provider is not enabled"), /belum diaktifkan/);
});
