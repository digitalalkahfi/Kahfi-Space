import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  entitasDari,
  masalahKv,
  ringkasKv,
  type EntriKv,
} from "../kv-store.ts";

test("entitas sebuah entri adalah kunci ekspornya sendiri", () => {
  // Satu kunci ekspor memuat seluruh catatannya sekaligus, jadi tidak
  // ada lagi potongan sebelum titik dua yang perlu diambil.
  assert.equal(entitasDari("users:list"), "users:list");
  assert.equal(entitasDari("daily-reports:all"), "daily-reports:all");
});

test("entri tanpa kunci ditandai", () => {
  assert.equal(entitasDari(""), "(tanpa entitas)");
  assert.equal(entitasDari("   "), "(tanpa entitas)");
});

test("ringkasan mengurutkan dari yang terbanyak", () => {
  const entri: EntriKv[] = [
    { key: "users:list", value: [{}] },
    { key: "daily-reports:all", value: [{}] },
    { key: "img:store", value: [{}] },
  ];
  const r = ringkasKv(entri);
  // Jumlahnya sama, jadi urutannya menurut abjad kuncinya.
  assert.deepEqual(
    r.map((x) => x.entitas),
    ["daily-reports:all", "img:store", "users:list"],
  );
});

test("kunci yang tidak dipetakan ditandai tidak dikenali", () => {
  const r = ringkasKv([
    { key: "img:store", value: [{}] },
    { key: "users:list", value: [{}] },
  ]);
  const peta = Object.fromEntries(r.map((x) => [x.entitas, x.dikenali]));
  assert.equal(peta["img:store"], false);
  assert.equal(peta["users:list"], true);
});

test("kunci ganda dilaporkan", () => {
  const m = masalahKv([
    { key: "users:list", value: [{}] },
    { key: "users:list", value: [{}] },
  ]);
  assert.equal(m.length, 1);
  assert.match(m[0].sebab, /lebih dari sekali/);
});

test("nilai kosong dan bukan objek dilaporkan", () => {
  const m = masalahKv([
    { key: "users:list", value: null },
    { key: "tasks:all", value: "teks" },
  ]);
  assert.equal(m.length, 2);
});

test("entri yang wajar tidak dilaporkan", () => {
  const m = masalahKv([
    { key: "users:list", value: [{ id: "u1" }] },
    { key: "attendance:config", value: { jamMasuk: "08:00" } },
  ]);
  assert.deepEqual(m, []);
});
