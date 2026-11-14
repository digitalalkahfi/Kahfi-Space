import { strict as assert } from "node:assert";
import { test } from "node:test";
import { KOLOM_PER_UNIT } from "../laporan.ts";
import { namaUnitDaftar } from "../pendaftaran.ts";
import {
  caraLapor,
  DAFTAR_UNIT,
  kodeUnitSah,
  melaporGmv,
  UNIT_GMV,
  UNIT_PELAPORAN,
} from "../unit-pelaporan.ts";

test("Sosial Impact: unit sah tanpa laporan GMV (0223)", () => {
  assert.ok(kodeUnitSah("sosial"));
  assert.equal(UNIT_PELAPORAN.sosial.nama, "Sosial Impact");
  assert.equal(melaporGmv("sosial"), false);
  assert.equal(caraLapor(UNIT_PELAPORAN.sosial), "tanpa laporan GMV");
  assert.deepEqual([...KOLOM_PER_UNIT.sosial], []);
  assert.equal(namaUnitDaftar("sosial"), "Sosial Impact");
});

test("unit pelapor GMV tidak berubah dan tetap satu-satunya tempat akun", () => {
  assert.deepEqual(
    DAFTAR_UNIT.map((u) => u.kode),
    ["affiliator", "mcn", "tap", "sosial"],
  );
  assert.deepEqual(
    UNIT_GMV.map((u) => u.kode),
    ["affiliator", "mcn", "tap"],
  );
  for (const u of UNIT_GMV) assert.ok(melaporGmv(u.kode), u.kode);
  assert.equal(caraLapor(UNIT_PELAPORAN.affiliator), "lapor per akun");
  assert.equal(caraLapor(UNIT_PELAPORAN.mcn), "lapor per unit");
});
