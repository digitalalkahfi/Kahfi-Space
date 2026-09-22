import { strict as assert } from "node:assert";
import { test } from "node:test";
import { barisCsv, berkasCsv, selCsv } from "../csv.ts";

test("sel biasa dibiarkan apa adanya", () => {
  assert.equal(selCsv("Beban operasional"), "Beban operasional");
  assert.equal(selCsv(-18_900_000), "-18900000");
  assert.equal(selCsv(null), "");
});

test("sel yang memuat pemisah dibungkus tanda kutip", () => {
  // Keterangan laporan memang memakai titik koma; tanpa pembungkus,
  // satu kalimat pecah jadi dua kolom.
  assert.equal(
    selCsv("Arus investasi; tidak mengurangi laba."),
    '"Arus investasi; tidak mengurangi laba."',
  );
});

test("tanda kutip di dalam sel digandakan", () => {
  assert.equal(selCsv('Sewa kantor "lantai 2"'), '"Sewa kantor ""lantai 2"""');
});

test("baris baru di dalam sel tidak memecah barisnya", () => {
  const isi = selCsv("Baris satu\nBaris dua");
  assert.equal(isi.startsWith('"'), true);
  assert.equal(isi.endsWith('"'), true);
});

test("baris disusun dengan titik koma", () => {
  assert.equal(barisCsv(["Pos", "Nilai", ""]), "Pos;Nilai;");
});

test("berkas diawali BOM dan berakhir dengan baris baru", () => {
  const berkas = berkasCsv(["a", "b"]);
  assert.equal(berkas.startsWith("﻿"), true);
  assert.equal(berkas, "﻿a\r\nb\r\n");
});
