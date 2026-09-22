import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  jedaPercobaanMenit,
  layakDicoba,
  urutkanAntrean,
} from "@/lib/antrean-wa";

const MAKS = 3;

test("jeda mundur bertahap, lalu berhenti bertambah", () => {
  assert.equal(jedaPercobaanMenit(0), 0);
  assert.equal(jedaPercobaanMenit(1), 5);
  assert.equal(jedaPercobaanMenit(2), 30);
  assert.equal(jedaPercobaanMenit(9), 30);
});

test("yang belum pernah dicoba selalu layak", () => {
  assert.equal(
    layakDicoba(
      { id: "a", percobaan: 0, terakhirPada: null },
      new Date("2024-10-24T10:00:00Z"),
      MAKS,
    ),
    true,
  );
});

test("yang baru saja gagal menunggu jedanya dulu", () => {
  const c = {
    id: "a",
    percobaan: 1,
    terakhirPada: "2024-10-24T10:00:00Z",
  };
  // Jeda untuk percobaan ke-1 adalah 5 menit.
  assert.equal(layakDicoba(c, new Date("2024-10-24T10:04:00Z"), MAKS), false);
  assert.equal(layakDicoba(c, new Date("2024-10-24T10:05:00Z"), MAKS), true);
});

test("percobaan kedua menunggu lebih lama daripada yang pertama", () => {
  const c = {
    id: "a",
    percobaan: 2,
    terakhirPada: "2024-10-24T10:00:00Z",
  };
  assert.equal(layakDicoba(c, new Date("2024-10-24T10:20:00Z"), MAKS), false);
  assert.equal(layakDicoba(c, new Date("2024-10-24T10:30:00Z"), MAKS), true);
});

test("yang sudah mencapai batas tidak dicoba lagi, sejauh apa pun jedanya", () => {
  assert.equal(
    layakDicoba(
      { id: "a", percobaan: MAKS, terakhirPada: "2020-01-01T00:00:00Z" },
      new Date("2024-10-24T10:00:00Z"),
      MAKS,
    ),
    false,
  );
});

test("yang paling lama menunggu dikerjakan lebih dulu", () => {
  // Bukan yang paling sedikit percobaannya: notifikasi yang tertahan
  // sejak pagi lebih mendesak daripada yang baru masuk semenit lalu.
  const urut = urutkanAntrean([
    { dibuatPada: "2024-10-24T12:00:00Z", id: "siang" },
    { dibuatPada: "2024-10-24T07:00:00Z", id: "pagi" },
    { dibuatPada: "2024-10-24T09:00:00Z", id: "tengah" },
  ]);
  assert.deepEqual(
    urut.map((x) => x.id),
    ["pagi", "tengah", "siang"],
  );
});

test("pengurutan tidak mengubah daftar aslinya", () => {
  const asli = [
    { dibuatPada: "2024-10-24T12:00:00Z" },
    { dibuatPada: "2024-10-24T07:00:00Z" },
  ];
  urutkanAntrean(asli);
  assert.equal(asli[0].dibuatPada, "2024-10-24T12:00:00Z");
});
