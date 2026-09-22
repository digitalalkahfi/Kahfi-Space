import { strict as assert } from "node:assert";
import { test } from "node:test";
import seed from "../../../supabase/seed/data.json" with { type: "json" };
import { STATUS_ASET, perpindahanAsetSah, type StatusAset } from "../aset.ts";

const aset = seed.aset ?? [];
const riwayat = seed.aset_riwayat ?? [];

test("data contoh punya aset untuk setiap keadaan", () => {
  const ada = new Set(aset.map((a) => a.status));
  for (const s of STATUS_ASET) {
    assert.ok(ada.has(s), `belum ada aset contoh berstatus ${s}`);
  }
});

test("kode aset tidak kembar dan berbentuk AST-0000", () => {
  const kode = aset.map((a) => a.kode);
  assert.equal(new Set(kode).size, kode.length);
  for (const k of kode) assert.match(k, /^AST-\d{4}$/);
});

test("pemegang aset adalah anggota yang dikenal", () => {
  const nama = new Set(seed.users.map((u) => u.nama));
  for (const a of aset) {
    if (a.pemegang) assert.ok(nama.has(a.pemegang), `${a.kode}: ${a.pemegang}`);
  }
});

test("aset yang berhenti dimiliki punya tanggal berakhir, yang lain tidak", () => {
  for (const a of aset) {
    const lepas = a.status === "dilepas" || a.status === "hilang";
    assert.equal(
      Boolean(a.berakhir),
      lepas,
      `${a.kode} berstatus ${a.status} tetapi berakhir=${a.berakhir}`,
    );
    if (a.berakhir) assert.ok(a.berakhir >= a.tanggal, a.kode);
  }
});

test("setiap aset punya riwayat yang dimulai dari perolehannya", () => {
  for (const a of aset) {
    const punya = riwayat
      .filter((k) => k.kode === a.kode)
      .sort((x, y) => x.pada.localeCompare(y.pada));

    assert.ok(punya.length > 0, `${a.kode} tanpa riwayat`);
    assert.equal(
      punya[0].dari,
      null,
      `${a.kode}: kejadian pertama bukan perolehan`,
    );
    assert.equal(
      punya[0].pada,
      a.tanggal,
      `${a.kode}: tanggal perolehan berbeda`,
    );
  }
});

test("riwayat berakhir pada keadaan dan pemegang yang tercatat sekarang", () => {
  for (const a of aset) {
    const terakhir = riwayat
      .filter((k) => k.kode === a.kode)
      .sort((x, y) => x.pada.localeCompare(y.pada))
      .at(-1)!;

    assert.equal(terakhir.ke, a.status, `${a.kode}: keadaan terakhir berbeda`);
    assert.equal(
      terakhir.pemegang ?? null,
      a.pemegang ?? null,
      `${a.kode}: pemegang terakhir berbeda`,
    );
  }
});

test("perpindahan keadaan dalam riwayat semuanya sah", () => {
  for (const k of riwayat) {
    if (!k.dari) continue;
    const dari = k.dari as StatusAset;
    const ke = k.ke as StatusAset;
    // Pindah tangan tanpa ganti keadaan bukan perpindahan status.
    if (dari === ke) continue;
    assert.ok(
      perpindahanAsetSah(dari, ke),
      `${k.kode}: ${dari} → ${ke} tidak sah`,
    );
  }
});

test("riwayat aset tidak menyebut tanggal berakhir yang berbeda", () => {
  for (const a of aset) {
    if (!a.berakhir) continue;
    const kejadian = riwayat.find(
      (k) => k.kode === a.kode && k.ke === a.status && k.dari !== null,
    );
    assert.ok(kejadian, `${a.kode}: tidak ada kejadian untuk status akhirnya`);
    assert.equal(kejadian.pada, a.berakhir, a.kode);
  }
});
