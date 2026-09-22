import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { aktifDemo } from "../demo.ts";

// Dibaca lewat fs, bukan import JSON: atribut impor hilang saat Node
// menanggalkan tipe TypeScript.
const seed = JSON.parse(
  readFileSync(
    new URL("../../../supabase/seed/data.json", import.meta.url),
    "utf8",
  ),
) as { users: { role: string; unit: string | null; status?: string }[] };

/**
 * Mode demo meniru RLS: setiap daftar calon di sana menyaring status
 * 'aktif' seperti query Supabase-nya. Satu orang nonaktif di data contoh
 * sengaja dipertahankan supaya penyaringannya benar-benar teruji.
 */
test("data contoh punya anggota nonaktif untuk diuji", () => {
  const nonaktif = seed.users.filter((u) => !aktifDemo(u));
  assert.ok(
    nonaktif.length > 0,
    "tanpa satu pun anggota nonaktif, penyaringan calon tidak pernah terbukti",
  );
});

test("status yang tidak ditulis berarti aktif", () => {
  assert.equal(aktifDemo({}), true);
  assert.equal(aktifDemo({ status: "aktif" }), true);
  assert.equal(aktifDemo({ status: "nonaktif" }), false);
});

test("anggota nonaktif bukan staf tanpa unit atau tanpa peran", () => {
  // Kalau orangnya kebetulan bukan Staff di sebuah unit, penyaringan PIC
  // akan lulus karena alasan yang salah.
  const nonaktif = seed.users.filter((u) => !aktifDemo(u));
  assert.ok(
    nonaktif.some((u) => u.role === "Staff" && u.unit),
    "perlu setidaknya satu Staff nonaktif berunit di data contoh",
  );
});
