import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bolehLihatKomisiSemua,
  komisiAkunTerlihat,
  labelAksesKomisi,
  PILIHAN_AKSES_KOMISI,
} from "@/lib/komisi";

test("K6/K7: hanya CEO dan Manager melihat semua komisi dan kartu total", () => {
  assert.equal(bolehLihatKomisiSemua("CEO"), true);
  assert.equal(bolehLihatKomisiSemua("Manager"), true);
  for (const p of ["Leader", "Co-Leader", "Staff", "Finance"] as const) {
    assert.equal(bolehLihatKomisiSemua(p), false, p);
  }
});

test("empat pilihan akses, bawaan 'Tidak ada'", () => {
  assert.deepEqual(
    PILIHAN_AKSES_KOMISI.map((p) => p.nilai),
    ["tidak", "pegangan", "tertentu", "semua"],
  );
  assert.equal(labelAksesKomisi(null), "Tidak ada");
  assert.equal(labelAksesKomisi("pegangan"), "Akun yang dia pegang");
  assert.equal(labelAksesKomisi("semua"), "Semua akun Affiliator");
});

test("komisi per akun terlihat hanya bila ada di cakupan", () => {
  assert.equal(komisiAkunTerlihat("semua", "a"), true);
  assert.equal(komisiAkunTerlihat("semua", null), true);
  const cakupan = new Set(["a", "b"]);
  assert.equal(komisiAkunTerlihat(cakupan, "a"), true);
  assert.equal(komisiAkunTerlihat(cakupan, "c"), false);
  // Laporan tingkat unit (tanpa akun) hanya untuk CEO/Manager.
  assert.equal(komisiAkunTerlihat(cakupan, null), false);
  assert.equal(komisiAkunTerlihat(new Set(), "a"), false);
});
