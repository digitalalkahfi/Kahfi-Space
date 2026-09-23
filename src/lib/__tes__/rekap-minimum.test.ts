import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  rekapMinimumPerAkun,
  rekapMinimumPerOrang,
  ringkasanRekapMinimum,
  type BarisRekap,
} from "@/lib/rekap-minimum";

const baris = (
  akunId: string | null,
  label: string,
  jumlahUpload: number | null,
  minimumUpload: number | null,
  pelaporNama = "Rian",
): BarisRekap => ({
  akunId,
  label,
  pelaporNama,
  jumlahUpload,
  minimumUpload,
});

test("mengelompokkan laporan per akun dan menghitung yang memenuhi", () => {
  const rekap = rekapMinimumPerAkun([
    baris("a", "@satu", 12, 10),
    baris("a", "@satu", 4, 10),
    baris("a", "@satu", 10, 10),
    baris("b", "@dua", 20, 20),
  ]);

  assert.equal(rekap.length, 2);
  const satu = rekap.find((r) => r.kunci === "a");
  assert.equal(satu?.laporan, 3);
  assert.equal(satu?.terpenuhi, 2, "tepat di batas ikut terpenuhi");
  assert.equal(Math.round(satu?.rasio ?? 0), 67);
  assert.equal(satu?.kurangTerdalam, 6);

  const dua = rekap.find((r) => r.kunci === "b");
  assert.equal(dua?.rasio, 100);
  assert.equal(dua?.kurangTerdalam, 0, "tidak pernah kurang");
});

test("yang tidak punya standar tidak ikut dinilai", () => {
  // Laporan unit (tanpa kolom unggahan) dan akun tanpa level.
  const rekap = rekapMinimumPerAkun([
    baris(null, "MCN (incl. MMC)", null, null),
    baris("a", "@tanpa_level", 3, null),
    baris("b", "@berlevel", 3, 10),
  ]);

  assert.deepEqual(
    rekap.map((r) => r.label),
    ["@berlevel"],
  );
});

test("yang paling bermasalah tampil lebih dulu", () => {
  const rekap = rekapMinimumPerAkun([
    baris("a", "@aman", 10, 10),
    baris("b", "@sedang", 10, 10),
    baris("b", "@sedang", 2, 10),
    baris("c", "@parah", 1, 10),
  ]);

  assert.deepEqual(
    rekap.map((r) => r.label),
    ["@parah", "@sedang", "@aman"],
  );
});

test("akun tanpa id dikelompokkan lewat labelnya", () => {
  const rekap = rekapMinimumPerAkun([
    baris(null, "@tanpa_id", 3, 10),
    baris(null, "@tanpa_id", 12, 10),
  ]);

  assert.equal(rekap.length, 1);
  assert.equal(rekap[0].laporan, 2);
});

test("dua batas dalam satu baris tidak dipaksakan jadi satu angka", () => {
  // Level naik di tengah rentang: tidak ada satu minimum yang jujur.
  const rekap = rekapMinimumPerAkun([
    baris("a", "@naik", 12, 10),
    baris("a", "@naik", 12, 15),
  ]);

  assert.equal(rekap[0].minimum, null);
  assert.equal(rekap[0].laporan, 2);
});

test("rekap per orang menyatukan seluruh akun yang ia pegang", () => {
  const rekap = rekapMinimumPerOrang([
    baris("a", "@satu", 12, 10, "Rian"),
    baris("b", "@dua", 2, 10, "Rian"),
    baris("c", "@tiga", 10, 10, "Dimas"),
  ]);

  assert.deepEqual(
    rekap.map((r) => [r.label, r.laporan, r.terpenuhi]),
    [
      ["Rian", 2, 1],
      ["Dimas", 1, 1],
    ],
  );
  assert.equal(rekap[0].minimum, 10, "dua akun, batas yang sama");
});

test("orang dengan akun berbeda level tidak punya satu minimum", () => {
  const rekap = rekapMinimumPerOrang([
    baris("a", "@satu", 12, 10, "Rian"),
    baris("b", "@dua", 4, 3, "Rian"),
  ]);

  assert.equal(rekap.length, 1);
  assert.equal(rekap[0].minimum, null);
  assert.equal(rekap[0].terpenuhi, 2);
});

test("ringkasan menjumlahkan seluruh baris yang dinilai", () => {
  const rekap = rekapMinimumPerAkun([
    baris("a", "@satu", 12, 10),
    baris("a", "@satu", 4, 10),
    baris("b", "@dua", 20, 20),
  ]);

  assert.deepEqual(ringkasanRekapMinimum(rekap), {
    baris: 2,
    laporan: 3,
    terpenuhi: 2,
    kurang: 1,
    rasio: (2 / 3) * 100,
  });
});

test("tanpa baris yang dinilai, tidak ada ringkasan", () => {
  assert.equal(ringkasanRekapMinimum([]), null);
  assert.equal(
    ringkasanRekapMinimum(
      rekapMinimumPerAkun([baris(null, "MCN", null, null)]),
    ),
    null,
  );
});
