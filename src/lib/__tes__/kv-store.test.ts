import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  entitasDari,
  masalahKv,
  ringkasKv,
  type EntriKv,
} from "../kv-store.ts";

test("entitas diambil dari bagian sebelum titik dua", () => {
  assert.equal(entitasDari("user:123"), "user");
  assert.equal(entitasDari("report:2024-10-24:@akun"), "report");
});

test("kunci tanpa pemisah ditandai", () => {
  assert.equal(entitasDari("tanpa_pemisah"), "(tanpa entitas)");
  // Kunci yang diawali titik dua juga tidak sah.
  assert.equal(entitasDari(":kosong"), "(tanpa entitas)");
});

test("ringkasan mengurutkan dari yang terbanyak", () => {
  const entri: EntriKv[] = [
    { key: "user:1", value: {} },
    { key: "report:a", value: {} },
    { key: "report:b", value: {} },
    { key: "seller:9", value: {} },
  ];
  const r = ringkasKv(entri);
  assert.deepEqual(
    r.map((x) => x.entitas),
    ["report", "seller", "user"],
  );
  assert.equal(r[0].jumlah, 2);
});

test("entitas asing ditandai tidak dikenali", () => {
  const r = ringkasKv([{ key: "seller:1", value: {} }]);
  assert.equal(r[0].dikenali, false);
});

test("kunci ganda dilaporkan", () => {
  const m = masalahKv([
    { key: "user:1", value: {} },
    { key: "user:1", value: {} },
  ]);
  assert.equal(m.length, 1);
  assert.match(m[0].sebab, /lebih dari sekali/);
});

test("nilai kosong dan bukan objek dilaporkan", () => {
  const m = masalahKv([
    { key: "account:@a", value: null },
    { key: "user:2", value: "teks" },
  ]);
  assert.equal(m.length, 2);
});

test("entri yang wajar tidak dilaporkan", () => {
  const m = masalahKv([
    { key: "user:1", value: { nama: "A" } },
    { key: "account:@b", value: { username: "@b" } },
  ]);
  assert.deepEqual(m, []);
});
