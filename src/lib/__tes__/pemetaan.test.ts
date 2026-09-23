import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  medanTakTerpetakan,
  ringkasPemetaan,
  versiPemetaan,
  type PemetaanEntitas,
} from "../pemetaan.ts";
import { PEMETAAN_V1 } from "../pemetaan-v1.ts";
import { kolomTanpaSumber } from "../migrasi.ts";
import { KUNCI_DIKENAL } from "../ekspor-v1.ts";

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

test("setiap kunci ekspor yang dikenali punya pemetaan", () => {
  // Kunci yang dinyatakan dipetakan tetapi tidak punya pemetaan akan
  // tersimpan tanpa pernah dipindahkan ke mana pun.
  const dipetakan = new Set(PEMETAAN_V1.map((p) => p.kunci));
  for (const k of KUNCI_DIKENAL) {
    assert.ok(dipetakan.has(k.kunci), `kunci ${k.kunci} belum punya pemetaan`);
  }
  assert.equal(PEMETAAN_V1.length, KUNCI_DIKENAL.length);
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
  for (const p of PEMETAAN_V1) {
    assert.match(versiPemetaan(p), /^[0-9a-f]{8}$/);
  }
});

test("kolom laporan harian ikut terpetakan", () => {
  // Kolom yang tidak disebut pemetaan tidak akan pernah ditinjau orang
  // sebelum migrasi dijalankan.
  const laporan = PEMETAAN_V1.find((p) => p.kunci === "daily-reports:all");
  assert.ok(laporan);
  const kolom = laporan.baris.map((b) => b.kolomBaru);
  for (const wajibAda of ["gmv", "komisi", "jumlah_upload", "catatan"]) {
    assert.ok(kolom.includes(wajibAda), `kolom ${wajibAda} belum dipetakan`);
  }
});

test("kolomTanpaSumber hanya menyebut kolom yang benar-benar dibiarkan kosong", () => {
  // `department_id` tidak ada di data lama dan tidak diisi nilai bawaan.
  assert.deepEqual(kolomTanpaSumber("users:list"), ["department_id"]);
  // `platform` bawaan tapi diisi nilai, jadi bukan kolom kosong.
  assert.equal(
    kolomTanpaSumber("affiliate-accounts:all").includes("platform"),
    false,
  );
  assert.deepEqual(kolomTanpaSumber("kunci-yang-tidak-ada"), []);
});
