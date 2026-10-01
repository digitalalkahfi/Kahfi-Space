import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  beriPeringkat,
  kelompokDariPeran,
  kelompokkanPapan,
  type BarisPapanKpi,
} from "../papan.ts";

test("level leaderboard dari peran, sama dengan kelompok_papan (0196)", () => {
  assert.equal(kelompokDariPeran("Leader"), "leader");
  assert.equal(kelompokDariPeran("Co-Leader"), "co_leader");
  assert.equal(kelompokDariPeran("Staff"), "staf");
  assert.equal(kelompokDariPeran("Finance"), "staf");
  assert.equal(kelompokDariPeran("CEO"), null);
  assert.equal(kelompokDariPeran("Manager"), null);
});

test("peringkat seperti rank(): nilai sama berbagi peringkat", () => {
  const hasil = beriPeringkat(
    [
      { n: "a", s: 600 },
      { n: "b", s: 1000 },
      { n: "c", s: 600 },
      { n: "d", s: 0 },
    ],
    (x) => x.s,
  );
  assert.deepEqual(
    hasil.map((x) => [x.n, x.peringkat]),
    [
      ["b", 1],
      ["a", 2],
      ["c", 2],
      ["d", 4],
    ],
  );
});

test("baris dikelompokkan per level tanpa mengubah urutannya", () => {
  const b = (userId: string, kelompok: BarisPapanKpi["kelompok"]) =>
    ({ userId, kelompok }) as BarisPapanKpi;
  const k = kelompokkanPapan([
    b("1", "leader"),
    b("2", "staf"),
    b("3", "leader"),
  ]);
  assert.deepEqual(
    k.leader.map((x) => x.userId),
    ["1", "3"],
  );
  assert.deepEqual(
    k.staf.map((x) => x.userId),
    ["2"],
  );
  assert.deepEqual(k.co_leader, []);
});
