import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  keEntriTenggat,
  masukKalender,
  type TugasKalender,
} from "@/lib/kalender";
import { rentangTanggalWib } from "@/lib/papan-tanggal";

const SAYA = "id-saya";
const LAIN = "id-lain";

// Rentang satu bulan kalender, seperti yang diminta `entriKalender`.
const DARI = "2026-10-01";
const SAMPAI = "2026-10-31";

const buat = (p: Partial<TugasKalender> = {}): TugasKalender => ({
  id: "t1",
  tipe: "tiket",
  judul: "Audit GMV akun beauty",
  deskripsi: "Lima akun teratas",
  penerima: "Rian H.",
  penerimaId: LAIN,
  tenggat: "2026-10-15T15:00:00+07:00",
  tanpaJam: false,
  statusAsli: "todo",
  ...p,
});

const masuk = (p: Partial<TugasKalender>) =>
  masukKalender(buat(p), SAYA, DARI, SAMPAI);

test("tenggat dini hari WIB tetap di tanggal WIB-nya, dengan jam WIB", () => {
  // Basis data mengirim timestamptz dalam UTC: 00.30 WIB 15 Okt adalah
  // 17.30 UTC 14 Okt.
  const e = keEntriTenggat(buat({ tenggat: "2026-10-14T17:30:00+00:00" }));
  assert.equal(e.tanggal, "2026-10-15");
  assert.equal(e.jamMulai, "00:30");

  // 06.59 WIB masih jatuh di hari sebelumnya bila dibaca sebagai UTC.
  const pagi = keEntriTenggat(buat({ tenggat: "2026-10-14T23:59:00+00:00" }));
  assert.equal(pagi.tanggal, "2026-10-15");
  assert.equal(pagi.jamMulai, "06:59");

  // Sejak 07.00 WIB tanggalnya sama, tetapi jamnya tetap harus WIB.
  const sore = keEntriTenggat(buat({ tenggat: "2026-10-15T08:00:00+00:00" }));
  assert.equal(sore.tanggal, "2026-10-15");
  assert.equal(sore.jamMulai, "15:00");
});

test("tenggat berzona +07:00 (data contoh) dibaca sama", () => {
  const e = keEntriTenggat(buat({ tenggat: "2026-10-15T00:30:00+07:00" }));
  assert.equal(e.tanggal, "2026-10-15");
  assert.equal(e.jamMulai, "00:30");
});

test("to-do tanpa jam menjadi entri sepanjang hari, bukan 23.59", () => {
  const e = keEntriTenggat(
    buat({
      tipe: "pribadi",
      // 23.59 WIB 15 Okt.
      tenggat: "2026-10-15T16:59:00+00:00",
      tanpaJam: true,
    }),
  );
  assert.equal(e.tanggal, "2026-10-15");
  assert.equal(e.jamMulai, null);
});

test("entri tenggat utuh, menaut ke modul Tugas", () => {
  assert.deepEqual(keEntriTenggat(buat()), {
    id: "tugas-t1",
    sumber: "tugas",
    judul: "Audit GMV akun beauty",
    keterangan: "Lima akun teratas",
    jenis: "tenggat",
    tanggal: "2026-10-15",
    jamMulai: "15:00",
    jamSelesai: null,
    unitKode: null,
    unitNama: "Rian H.",
    lokasi: "",
    tautan: "/tugas",
    dibuatOleh: null,
  });
});

test("yang sudah selesai atau dibatalkan bukan lagi tenggat", () => {
  assert.equal(masuk({ statusAsli: "selesai" }), false);
  assert.equal(masuk({ statusAsli: "dibatalkan" }), false);
  for (const statusAsli of [
    "todo",
    "berjalan",
    "menunggu_qc",
    "revisi",
  ] as const) {
    assert.equal(masuk({ statusAsli }), true, statusAsli);
  }
});

test("to-do pribadi hanya milik sendiri, dibandingkan lewat id", () => {
  assert.equal(masuk({ tipe: "pribadi", penerimaId: SAYA }), true);
  // RLS mengizinkan CEO/Manager membaca to-do orang lain; kalender tidak
  // menampilkannya.
  assert.equal(masuk({ tipe: "pribadi", penerimaId: LAIN }), false);
  // Tiket & komitmen orang lain: cakupannya ditentukan RLS.
  assert.equal(masuk({ tipe: "tiket", penerimaId: LAIN }), true);
  assert.equal(masuk({ tipe: "komitmen_mingguan", penerimaId: LAIN }), true);
});

test("batas rentang dihitung dalam WIB, kedua ujungnya inklusif", () => {
  assert.equal(masuk({ tenggat: "2026-10-01T00:00:00+07:00" }), true);
  assert.equal(masuk({ tenggat: "2026-10-31T23:59:00+07:00" }), true);
  assert.equal(masuk({ tenggat: "2026-09-30T23:59:00+07:00" }), false);
  assert.equal(masuk({ tenggat: "2026-11-01T00:00:00+07:00" }), false);
  // 30 Sep 17.30 UTC sudah 1 Okt WIB; 31 Okt 17.00 UTC sudah 1 Nov WIB.
  assert.equal(masuk({ tenggat: "2026-09-30T17:30:00Z" }), true);
  assert.equal(masuk({ tenggat: "2026-10-31T17:00:00Z" }), false);
});

test("tugas tanpa tenggat tidak masuk kalender", () => {
  assert.equal(masuk({ tenggat: "" }), false);
});

test("mode demo dan kueri basis data sepakat soal batas rentang", () => {
  // `masukKalender` membandingkan tanggal WIB; kueri membandingkan waktu
  // dengan `rentangTanggalWib`. Di sekitar batas, jawabannya harus sama.
  const { awal, akhir } = rentangTanggalWib(DARI, SAMPAI);
  for (const tenggat of [
    "2026-09-30T16:59:59Z",
    "2026-09-30T17:00:00Z",
    "2026-10-15T05:00:00Z",
    "2026-10-31T16:59:59Z",
    "2026-10-31T17:00:00Z",
  ]) {
    const waktu = Date.parse(tenggat);
    const kueri = waktu >= Date.parse(awal) && waktu < Date.parse(akhir);
    assert.equal(masuk({ tenggat }), kueri, tenggat);
  }
});
