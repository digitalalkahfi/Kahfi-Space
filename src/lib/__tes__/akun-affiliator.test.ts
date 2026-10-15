import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  barisAkunAffiliator,
  barisLaporanUnit,
  totalAkun,
  urutkanAkun,
} from "@/lib/akun-affiliator";
import { KEPATUHAN_KOSONG } from "@/lib/batas-minimum";

const akun = (
  id: string,
  p: Partial<Parameters<typeof barisAkunAffiliator>[0][number]> = {},
) => ({
  id,
  username: `@${id}`,
  status: "aktif" as const,
  picNama: "Rian",
  level: 1,
  minimum: 2,
  gmvPeriode: 0,
  kepatuhan: { hariKerja: 10, terpenuhi: 8, rasio: 80, minimum: 2 },
  ...p,
});

test("AC8: akun aktif tanpa laporan tetap tampil dengan nilai 0 dan ditandai", () => {
  const [b] = barisAkunAffiliator([akun("a")], []);
  assert.equal(b.tanpaLaporan, true);
  assert.equal(b.gmv, 0);
  assert.equal(b.komisi, 0);
  assert.equal(b.hariLapor, 0);
});

test("akun nonaktif hanya tampil bila punya GMV atau komisi", () => {
  const baris = barisAkunAffiliator(
    [
      akun("diam", { status: "nonaktif" }),
      akun("gmv", { status: "nonaktif", gmvPeriode: 5_000 }),
      akun("komisi", { status: "nonaktif" }),
    ],
    [],
    new Map([["komisi", 1_000]]),
  );
  assert.deepEqual(
    baris.map((b) => b.id),
    ["gmv", "komisi"],
  );
  assert.ok(baris.every((b) => !b.tanpaLaporan));
});

test("upload, hari lapor, rata-rata per hari kerja, dan komisi dihitung per akun", () => {
  const [b] = barisAkunAffiliator(
    [akun("a", { gmvPeriode: 3_000_000 })],
    [
      { accountId: "a", upload: 3, komisi: null },
      { accountId: "a", upload: 4, komisi: null },
      { accountId: "lain", upload: 9, komisi: null },
    ],
    new Map([["a", 75_000]]),
  );
  assert.equal(b.totalUpload, 7);
  assert.equal(b.hariLapor, 2);
  assert.equal(b.rataUpload, 0.7);
  assert.equal(b.komisi, 75_000);
  assert.equal(b.kepatuhan, 80);
});

test("E7: akun tanpa level → kepatuhan belum dinilai (null), rata-rata tanpa hari kerja null", () => {
  const [b] = barisAkunAffiliator(
    [
      akun("a", {
        level: null,
        minimum: null,
        kepatuhan: { ...KEPATUHAN_KOSONG },
      }),
    ],
    [],
  );
  assert.equal(b.level, null);
  assert.equal(b.kepatuhan, null);
  assert.equal(b.rataUpload, null);
});

test("urutan bawaan GMV terbesar; kosong selalu di bawah", () => {
  const baris = barisAkunAffiliator(
    [
      akun("kecil", { gmvPeriode: 1 }),
      akun("besar", { gmvPeriode: 9 }),
      akun("tanpa-level", { gmvPeriode: 5, level: null }),
    ],
    [],
  );
  assert.deepEqual(
    urutkanAkun(baris, "gmv", "turun").map((b) => b.id),
    ["besar", "tanpa-level", "kecil"],
  );
  assert.deepEqual(
    urutkanAkun(baris, "level", "naik").map((b) => b.id),
    ["besar", "kecil", "tanpa-level"],
  );
  assert.deepEqual(
    urutkanAkun(baris, "level", "turun").map((b) => b.id),
    ["besar", "kecil", "tanpa-level"],
  );
});

test("AC7: total GMV tabel termasuk laporan tingkat unit", () => {
  const baris = barisAkunAffiliator(
    [akun("a", { gmvPeriode: 1_000 }), akun("b", { gmvPeriode: 2_000 })],
    [{ accountId: "a", upload: 2, komisi: null }],
    new Map([["a", 100]]),
  );
  baris.push(barisLaporanUnit([{ gmv: 500, upload: null }], 50));
  assert.deepEqual(totalAkun(baris), { upload: 2, gmv: 3_500, komisi: 150 });
});
