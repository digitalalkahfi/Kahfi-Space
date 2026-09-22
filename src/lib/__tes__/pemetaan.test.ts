import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  medanTakTerpetakan,
  PEMETAAN,
  ringkasPemetaan,
  versiPemetaan,
  type PemetaanEntitas,
} from "../pemetaan.ts";

const contoh: PemetaanEntitas = {
  kunci: "uji",
  label: "Uji",
  tabelBaru: "uji",
  baris: [
    { medanLama: "a", kolomBaru: "a_baru", ubahan: "apa-adanya", wajib: true },
    { medanLama: null, kolomBaru: "b_baru", ubahan: "bawaan", wajib: false },
  ],
  dibuang: [{ medanLama: "c", alasan: "tidak dipakai lagi" }],
};

test("setiap entitas kv_store punya pemetaan", () => {
  const kunci = PEMETAAN.map((p) => p.kunci).sort();
  assert.deepEqual(kunci, [
    "account",
    "attendance",
    "goal",
    "report",
    "task",
    "user",
  ]);
});

test("tidak ada kolom tujuan yang ganda dalam satu entitas", () => {
  for (const p of PEMETAAN) {
    const kolom = p.baris.map((b) => b.kolomBaru);
    assert.equal(
      new Set(kolom).size,
      kolom.length,
      `kolom ganda pada entitas ${p.kunci}`,
    );
  }
});

test("medan asing terdeteksi", () => {
  assert.deepEqual(medanTakTerpetakan(contoh, ["a", "c", "z"]), ["z"]);
});

test("medan yang sengaja dibuang bukan medan asing", () => {
  assert.deepEqual(medanTakTerpetakan(contoh, ["c"]), []);
});

test("ringkasan menghitung tiap jenis baris", () => {
  const r = ringkasPemetaan(contoh);
  assert.equal(r.dipindahkan, 1);
  assert.equal(r.bawaan, 1);
  assert.equal(r.dibuang, 1);
  assert.equal(r.wajib, 1);
});

test("versi berubah begitu pemetaan disunting", () => {
  const sebelum = versiPemetaan(contoh);
  const sesudah = versiPemetaan({
    ...contoh,
    baris: [
      {
        medanLama: "a",
        kolomBaru: "a_lain",
        ubahan: "apa-adanya",
        wajib: true,
      },
      contoh.baris[1],
    ],
  });
  assert.notEqual(sebelum, sesudah);
});

test("versi tetap sama bila pemetaan tidak berubah", () => {
  assert.equal(versiPemetaan(contoh), versiPemetaan({ ...contoh }));
});

test("versi berbentuk sidik heksadesimal delapan digit", () => {
  for (const p of PEMETAAN) {
    assert.match(versiPemetaan(p), /^[0-9a-f]{8}$/);
  }
});
