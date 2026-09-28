import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bawahanTransitif,
  dalamLingkup,
  idTerlihat,
  lihatSemuaOrang,
  saringLingkup,
} from "@/lib/lingkup";

// CEO → Manager → Leader (L) → Co-Leader (C) → Staff (S1, S2); Staff S3
// langsung di bawah Leader; Staff S4 di unit lain di bawah Leader lain.
const ORANG = [
  { id: "ceo", atasanId: null },
  { id: "mgr", atasanId: "ceo" },
  { id: "L", atasanId: "mgr" },
  { id: "C", atasanId: "L" },
  { id: "S1", atasanId: "C" },
  { id: "S2", atasanId: "C" },
  { id: "S3", atasanId: "L" },
  { id: "L2", atasanId: "mgr" },
  { id: "S4", atasanId: "L2" },
];

test("hanya CEO dan Manager yang melihat seluruh organisasi", () => {
  assert.equal(lihatSemuaOrang("CEO"), true);
  assert.equal(lihatSemuaOrang("Manager"), true);
  assert.equal(lihatSemuaOrang("Finance"), false);
  assert.equal(lihatSemuaOrang("Leader"), false);
  assert.equal(lihatSemuaOrang("Co-Leader"), false);
  assert.equal(lihatSemuaOrang("Staff"), false);
});

test("bawahan transitif menuruni seluruh cabang", () => {
  assert.deepEqual([...bawahanTransitif(ORANG, "L")].sort(), [
    "C",
    "S1",
    "S2",
    "S3",
  ]);
  assert.deepEqual([...bawahanTransitif(ORANG, "C")].sort(), ["S1", "S2"]);
  assert.deepEqual([...bawahanTransitif(ORANG, "S1")], []);
});

test("Leader melihat dirinya dan semua di bawahnya, bukan Leader lain", () => {
  const leader = { id: "L", role: "Leader" as const };
  assert.deepEqual([...(idTerlihat(leader, ORANG) ?? [])].sort(), [
    "C",
    "L",
    "S1",
    "S2",
    "S3",
  ]);
  assert.equal(dalamLingkup(leader, "S4", ORANG), false, "unit lain");
  assert.equal(dalamLingkup(leader, "mgr", ORANG), false, "atasannya");
});

test("Co-Leader hanya melihat dirinya dan Staff yang melapor kepadanya", () => {
  const co = { id: "C", role: "Co-Leader" as const };
  assert.deepEqual([...(idTerlihat(co, ORANG) ?? [])].sort(), [
    "C",
    "S1",
    "S2",
  ]);
  assert.equal(
    dalamLingkup(co, "S3", ORANG),
    false,
    "rekan seunit di bawah Leader",
  );
  assert.equal(dalamLingkup(co, "L", ORANG), false, "Leader-nya sendiri");
});

test("Staff hanya melihat dirinya sendiri", () => {
  const staf = { id: "S1", role: "Staff" as const };
  assert.deepEqual([...(idTerlihat(staf, ORANG) ?? [])], ["S1"]);
  assert.equal(dalamLingkup(staf, "S2", ORANG), false, "rekan sejawat");
});

test("Manager melihat semua; saringan mengembalikan seluruh daftar", () => {
  const mgr = { id: "mgr", role: "Manager" as const };
  assert.equal(idTerlihat(mgr, ORANG), null);
  assert.equal(saringLingkup(mgr, ORANG).length, ORANG.length);
  assert.deepEqual(
    saringLingkup({ id: "L2", role: "Leader" }, ORANG).map((o) => o.id),
    ["L2", "S4"],
  );
});

test("data yang melingkar tidak membuat pencarian berputar selamanya", () => {
  const lingkar = [
    { id: "a", atasanId: "b" },
    { id: "b", atasanId: "a" },
  ];
  assert.deepEqual([...bawahanTransitif(lingkar, "a")], ["b"]);
});
