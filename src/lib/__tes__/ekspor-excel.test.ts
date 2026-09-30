import { strict as assert } from "node:assert";
import { test } from "node:test";
import { namaBerkasTanggal } from "../ekspor-excel.ts";

test("nama berkas ekspor memakai tanggal WIB, bukan tanggal UTC", () => {
  // 17:30 UTC tanggal 29 = 00:30 WIB tanggal 30.
  assert.equal(
    namaBerkasTanggal("k-space-log-aset", new Date("2026-09-29T17:30:00Z")),
    "k-space-log-aset-2026-09-30",
  );
  // Satu detik sebelum tengah malam WIB masih tanggal yang sama.
  assert.equal(
    namaBerkasTanggal("k-space-log-aset", new Date("2026-09-29T16:59:59Z")),
    "k-space-log-aset-2026-09-29",
  );
});
