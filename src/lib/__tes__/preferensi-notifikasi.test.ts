import { strict as assert } from "node:assert";
import { test } from "node:test";
import { KATEGORI_NOTIFIKASI } from "@/lib/notifikasi";
import {
  bolehMematikan,
  dikirimLewat,
  gabungPreferensi,
  preferensiAwal,
  ringkasPreferensi,
  ubahPreferensi,
} from "@/lib/preferensi-notifikasi";

test("bawaan: semua in-app menyala, semua WhatsApp mati", () => {
  const awal = preferensiAwal();
  assert.equal(awal.length, KATEGORI_NOTIFIKASI.length);
  assert.ok(awal.every((p) => p.inApp));
  // Kanal yang mengirim ke ponsel pribadi tidak boleh menyala tanpa
  // seseorang memilihnya.
  assert.ok(awal.every((p) => !p.whatsapp));
});

test("hanya CEO dan Manager yang boleh mematikan", () => {
  assert.equal(bolehMematikan("CEO"), true);
  assert.equal(bolehMematikan("Manager"), true);
  for (const peran of ["Leader", "Co-Leader", "Staff", "Finance"] as const) {
    assert.equal(bolehMematikan(peran), false, peran);
  }
});

test("kategori yang belum pernah diatur mengikuti bawaan", () => {
  const hasil = gabungPreferensi([
    { kategori: "tugas", inApp: false, whatsapp: false },
  ]);
  assert.equal(hasil.length, KATEGORI_NOTIFIKASI.length);
  assert.equal(hasil.find((p) => p.kategori === "tugas")?.inApp, false);
  assert.equal(hasil.find((p) => p.kategori === "izin")?.inApp, true);
});

test("penggabungan mengabaikan baris tanpa kategori, bukan melempar", () => {
  const hasil = gabungPreferensi([
    { inApp: false },
    { kategori: "izin", inApp: false },
  ]);
  assert.equal(hasil.length, KATEGORI_NOTIFIKASI.length);
  assert.equal(hasil.find((p) => p.kategori === "izin")?.inApp, false);
});

test("peran biasa ditolak saat mematikan, tapi tetap boleh menyalakan", () => {
  const awal = gabungPreferensi([
    { kategori: "tugas", inApp: false, whatsapp: false },
  ]);

  const matikan = ubahPreferensi(awal, "izin", "inApp", false, "Staff");
  assert.ok(matikan.ditolak);
  assert.deepEqual(matikan.hasil, awal, "keadaan tidak boleh berubah");

  const nyalakan = ubahPreferensi(awal, "tugas", "inApp", true, "Staff");
  assert.equal(nyalakan.ditolak, undefined);
  assert.equal(nyalakan.hasil.find((p) => p.kategori === "tugas")?.inApp, true);
});

test("mematikan in-app ikut mematikan WhatsApp-nya", () => {
  const awal = gabungPreferensi([
    { kategori: "tugas", inApp: true, whatsapp: true },
  ]);
  const { hasil } = ubahPreferensi(awal, "tugas", "inApp", false, "Manager");
  const tugas = hasil.find((p) => p.kategori === "tugas")!;
  assert.equal(tugas.inApp, false);
  assert.equal(tugas.whatsapp, false);
});

test("WhatsApp tidak bisa menyala sendirian tanpa in-app", () => {
  const awal = gabungPreferensi([
    { kategori: "tugas", inApp: false, whatsapp: false },
  ]);
  const hasil = ubahPreferensi(awal, "tugas", "whatsapp", true, "Manager");
  assert.ok(hasil.ditolak);
  assert.match(hasil.ditolak ?? "", /Nyalakan dulu/i);
  assert.equal(
    hasil.hasil.find((p) => p.kategori === "tugas")?.whatsapp,
    false,
  );
});

test("dikirimLewat memperhitungkan bahwa WhatsApp butuh in-app", () => {
  const p = gabungPreferensi([
    { kategori: "tugas", inApp: true, whatsapp: true },
    { kategori: "izin", inApp: false, whatsapp: true },
  ]);
  assert.equal(dikirimLewat(p, "tugas", "inApp"), true);
  assert.equal(dikirimLewat(p, "tugas", "whatsapp"), true);
  assert.equal(dikirimLewat(p, "izin", "inApp"), false);
  // Tersimpan menyala, tapi rumahnya mati — tidak dikirim.
  assert.equal(dikirimLewat(p, "izin", "whatsapp"), false);
});

test("ringkasan menghitung WhatsApp hanya yang benar-benar terkirim", () => {
  const p = gabungPreferensi([
    { kategori: "tugas", inApp: true, whatsapp: true },
    { kategori: "izin", inApp: false, whatsapp: true },
  ]);
  const r = ringkasPreferensi(p);
  assert.equal(r.total, KATEGORI_NOTIFIKASI.length);
  assert.equal(r.inApp, KATEGORI_NOTIFIKASI.length - 1);
  assert.equal(r.whatsapp, 1);
});
