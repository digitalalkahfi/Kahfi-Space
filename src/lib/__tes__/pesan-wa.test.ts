import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  MAKS_PESAN,
  bacaBalasanGateway,
  galatJaringan,
  susunPesanWa,
} from "@/lib/pesan-wa";

const contoh = {
  kategori: "tugas" as const,
  judul: "Tugas baru: Naikkan konten beauty",
  pesan: "Affiliator · pekan ini",
  tautan: "/tugas",
};

test("pesan memuat kategori, judul, isi, dan jalan masuknya", () => {
  const teks = susunPesanWa(contoh);
  assert.match(teks, /K-Space · Tugas/);
  assert.match(teks, /Naikkan konten beauty/);
  assert.match(teks, /Affiliator · pekan ini/);
  assert.match(teks, /\/tugas/);
});

test("tautan dikirim sebagai jalur, bukan URL penuh", () => {
  // Pesan WhatsApp mudah diteruskan; URL lengkap ke dasbor internal
  // yang mendarat di grup keluarga adalah kebocoran yang tidak
  // disengaja siapa pun.
  const teks = susunPesanWa(contoh);
  assert.ok(!/https?:\/\//.test(teks), `tidak boleh ada URL penuh: ${teks}`);
});

test("isi kosong tidak meninggalkan baris kosong", () => {
  const teks = susunPesanWa({ ...contoh, pesan: "   " });
  assert.ok(
    !teks.includes("\n\n"),
    `ada baris kosong: ${JSON.stringify(teks)}`,
  );
});

test("pesan yang kepanjangan dipotong, bukan ditolak", () => {
  const teks = susunPesanWa({ ...contoh, pesan: "x".repeat(MAKS_PESAN * 2) });
  assert.equal(teks.length, MAKS_PESAN);
  assert.ok(teks.endsWith("…"));
});

test("jawaban 2xx berarti terkirim", () => {
  for (const status of [200, 201, 202, 204]) {
    const h = bacaBalasanGateway(status, "{}");
    assert.equal(h.ok, true, String(status));
  }
});

test("4xx tidak diulang — permintaan yang sama akan salah lagi", () => {
  for (const status of [400, 401, 403, 404, 422]) {
    const h = bacaBalasanGateway(status, "nomor tidak terdaftar");
    assert.equal(h.ok, false, String(status));
    assert.equal(h.ok === false && h.bolehUlang, false, String(status));
  }
});

test("408, 429, dan 5xx diulang — keadaannya sementara", () => {
  for (const status of [408, 429, 500, 502, 503, 504]) {
    const h = bacaBalasanGateway(status, "");
    assert.equal(h.ok, false, String(status));
    assert.equal(h.ok === false && h.bolehUlang, true, String(status));
  }
});

test("429 menyebut pembatasan laju, bukan galat umum", () => {
  const h = bacaBalasanGateway(429, "");
  assert.equal(h.ok, false);
  assert.match(h.ok === false ? h.galat : "", /laju/i);
});

test("balasan gateway yang panjang dipotong sebelum disimpan", () => {
  const h = bacaBalasanGateway(500, "y".repeat(5000));
  assert.equal(h.balasan.length, 2000);
});

test("kegagalan jaringan selalu layak diulang", () => {
  const h = galatJaringan("timeout");
  assert.equal(h.ok, false);
  assert.equal(h.ok === false && h.bolehUlang, true);
  assert.match(h.ok === false ? h.galat : "", /timeout/);
});
