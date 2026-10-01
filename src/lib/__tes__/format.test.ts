import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bacaAngka,
  bulanPanjang,
  bulanPendek,
  hariIniWib,
  jamWib,
  keJamWib,
  keTanggalWib,
  tanggalKalenderPanjang,
  tanggalKalenderPendek,
  tanggalKalenderRelatif,
  tanggalPanjang,
  tanggalPendek,
  tanggalRelatif,
} from "../format.ts";

test("label bulan memakai nama bulan Indonesia", () => {
  assert.equal(bulanPanjang("2024-10-01"), "Oktober 2024");
  assert.equal(bulanPanjang("2024-01-01"), "Januari 2024");
  assert.equal(bulanPanjang("2024-05-01"), "Mei 2024");
});

test("label bulan tidak mundur karena zona waktu", () => {
  // Tanggal 1 yang diurai sebagai waktu lokal di zona barat Greenwich
  // akan mundur ke bulan sebelumnya; label harus tetap bulan itu.
  assert.equal(bulanPanjang("2024-10-15"), "Oktober 2024");
  assert.equal(bulanPendek("2024-03-01"), "Mar 2024");
});

test("tanggal panjang memuat nama hari Indonesia", () => {
  // 24 Oktober 2024 jatuh pada Kamis.
  const teks = tanggalPanjang("2024-10-24T03:00:00Z");
  assert.match(teks, /Kamis/);
  assert.match(teks, /Oktober/);
  assert.match(teks, /2024/);
});

test("tanggal pendek memakai singkatan Indonesia", () => {
  assert.match(tanggalPendek("2024-10-24T03:00:00Z"), /Okt/);
});

test("jam ditulis 24 jam dengan penanda WIB", () => {
  // 07:48 WIB = 00:48 UTC.
  assert.equal(jamWib("2024-10-24T00:48:00Z"), "07:48 WIB");
  assert.equal(jamWib("2024-10-24T10:00:00Z"), "17:00 WIB");
});

test("jam memakai titik dua, bukan titik", () => {
  // Lokal id-ID menulis 07.48; yang dipakai di layar adalah 07:48.
  assert.equal(jamWib("2024-10-24T00:48:00Z").includes("."), false);
});

test("tengah malam WIB tidak berubah menjadi 24", () => {
  assert.equal(jamWib("2024-10-23T17:00:00Z"), "00:00 WIB");
});

test("hari ini dihitung di WIB, bukan UTC", () => {
  // 17:30 UTC = 00:30 WIB keesokan harinya.
  assert.equal(hariIniWib(new Date("2026-09-29T17:30:00Z")), "2026-09-30");
  // Satu detik sebelum tengah malam WIB masih tanggal yang sama.
  assert.equal(hariIniWib(new Date("2026-09-29T16:59:59Z")), "2026-09-29");
  assert.equal(hariIniWib(new Date("2026-09-29T17:00:00Z")), "2026-09-30");
});

test("tanggal WIB sebuah tenggat: 23:59 WIB tetap di tanggal itu", () => {
  assert.equal(keTanggalWib("2026-10-02T23:59:00+07:00"), "2026-10-02");
  assert.equal(keTanggalWib("2026-10-02T00:00:00+07:00"), "2026-10-02");
  assert.equal(keTanggalWib("2026-10-01T17:00:00Z"), "2026-10-02");
  assert.equal(keTanggalWib("bukan tanggal"), "");
});

test("tanggal kalender tidak bergeser karena zona waktu", () => {
  assert.equal(tanggalKalenderPanjang("2026-09-16"), "Rabu, 16 September 2026");
  assert.equal(tanggalKalenderPendek("2026-10-02", "2026-09-29"), "2 Okt");
  assert.match(tanggalKalenderPendek("2025-12-31", "2026-01-01"), /2025/);
});

test("jam WIB untuk mengisi ulang isian jam", () => {
  assert.equal(keJamWib("2026-10-02T08:00:00Z"), "15:00");
  assert.equal(keJamWib("2026-10-02T23:59:00+07:00"), "23:59");
  assert.equal(keJamWib("rusak"), "");
});

test("tanggal relatif dihitung dari tanggal kalender WIB", () => {
  assert.equal(tanggalKalenderRelatif("2026-09-29", "2026-09-29"), "Hari ini");
  assert.equal(tanggalKalenderRelatif("2026-09-30", "2026-09-29"), "Besok");
  assert.equal(tanggalKalenderRelatif("2026-09-28", "2026-09-29"), "Kemarin");
  assert.equal(tanggalKalenderRelatif("2026-10-02", "2026-09-29"), "2 Okt");
  assert.equal(tanggalKalenderRelatif("", "2026-09-29"), "");
});

test("tanggal relatif sebuah cap waktu dihitung di WIB, bukan zona mesinnya", () => {
  // 17:30 UTC tanggal 29 = 00:30 WIB tanggal 30. Dengan zona mesin, SSR
  // (UTC) menulis "Kemarin" sementara peramban (WIB) menulis "Hari ini".
  assert.equal(
    tanggalRelatif("2026-09-29T17:30:00+00:00", "2026-09-30"),
    "Hari ini",
  );
  assert.equal(
    tanggalRelatif("2026-09-29T16:59:00+00:00", "2026-09-30"),
    "Kemarin",
  );
  assert.equal(
    tanggalRelatif("2026-09-28T16:59:00+00:00", "2026-09-30"),
    "28 Sep 2026",
  );
  // Acuan berupa cap waktu: 02:00 WIB tanggal 30 vs 23:00 WIB tanggal 29.
  assert.equal(
    tanggalRelatif("2026-09-29T16:00:00Z", "2026-09-29T19:00:00Z"),
    "Kemarin",
  );
  // Tanggal kalender tanpa jam tidak bergeser.
  assert.equal(tanggalRelatif("2026-09-29", "2026-09-30"), "Kemarin");
  assert.equal(tanggalRelatif("rusak", "2026-09-30"), "");
});

test("tanggal pendek & panjang ditulis di WIB, bukan zona mesin yang merender", () => {
  // SSR di Vercel berjalan dalam UTC: tanpa zona eksplisit, cap waktu
  // 00.00–06.59 WIB tertulis sehari lebih awal di server.
  const zonaSemula = process.env.TZ;
  process.env.TZ = "UTC";
  try {
    // 17:30 UTC tanggal 29 = 00:30 WIB tanggal 30.
    assert.equal(tanggalPendek("2026-09-29T17:30:00Z"), "30 Sep 2026");
    assert.equal(tanggalPendek("2026-09-29T16:59:00Z"), "29 Sep 2026");
    assert.equal(
      tanggalPanjang("2026-09-29T17:30:00Z"),
      "Rabu, 30 September 2026",
    );
    // Tanggal kalender tanpa jam tidak bergeser.
    assert.equal(tanggalPendek("2026-09-30"), "30 Sep 2026");
    assert.equal(tanggalPanjang("2026-09-30"), "Rabu, 30 September 2026");
  } finally {
    if (zonaSemula === undefined) delete process.env.TZ;
    else process.env.TZ = zonaSemula;
  }
});

test("bacaAngka membaca cara tulis Indonesia dan menolak yang meragukan", () => {
  assert.equal(bacaAngka(""), null);
  assert.equal(bacaAngka("  "), null);
  assert.equal(bacaAngka("90"), 90);
  assert.equal(bacaAngka("92,5"), 92.5);
  assert.equal(bacaAngka("92,5%"), 92.5);
  assert.equal(bacaAngka("0,875"), 0.875);
  assert.equal(bacaAngka("1.500"), 1500);
  assert.equal(bacaAngka("1.500.000,25"), 1500000.25);
  assert.equal(bacaAngka(" 103,25 "), 103.25);
  // Titik desimal gaya Inggris tidak ditebak menjadi 925.
  assert.ok(Number.isNaN(bacaAngka("92.5") as number));
  assert.ok(Number.isNaN(bacaAngka("1.50") as number));
  assert.ok(Number.isNaN(bacaAngka("-5") as number));
  assert.ok(Number.isNaN(bacaAngka("sepuluh") as number));
});
