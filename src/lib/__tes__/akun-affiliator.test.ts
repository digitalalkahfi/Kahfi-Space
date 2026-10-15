import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  barisAkunAffiliator,
  barisLaporanUnit,
  denganPembanding,
  perubahan,
  totalAkun,
  urutkanAkun,
} from "@/lib/akun-affiliator";
import { bandingkan } from "@/lib/gmv";
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

// ---------------------------------------------------------------------
// Naik/turun per akun (docs/DETAIL-PER-AKUN-GRAFIK.md §4)
// ---------------------------------------------------------------------

test("AC1: perubahan dihitung dengan bandingkan() yang sama dengan kartu Metrik utama", () => {
  for (const [sekarang, lalu] of [
    [1_124_000, 1_000_000],
    [919_000, 1_000_000],
    [5, 3],
    [2, 7],
  ] as const) {
    const b = bandingkan(sekarang, lalu);
    const p = perubahan(sekarang, lalu);
    assert.equal(p.persen, b.persen);
    assert.equal(p.arah, b.arah);
  }
  assert.equal(perubahan(1_124_000, 1_000_000).teks, "▲ 12,4%");
  assert.equal(perubahan(919_000, 1_000_000).teks, "▼ 8,1%");
  assert.equal(perubahan(500, 500).teks, "= 0%");
});

test("AC2: tanpa data periode lalu → Baru; keduanya 0 → —", () => {
  assert.deepEqual(perubahan(10, 0), { arah: "baru", teks: "Baru", persen: null });
  assert.deepEqual(perubahan(0, 0), { arah: "kosong", teks: "—", persen: null });
});

test("pembanding dipasang per id akun; akun yang tak ada di periode lalu dianggap 0", () => {
  const sekarang = barisAkunAffiliator(
    [akun("a", { gmvPeriode: 200 }), akun("b", { gmvPeriode: 50 })],
    [{ accountId: "a", upload: 4, komisi: null }],
    new Map([["a", 20]]),
  );
  const lalu = barisAkunAffiliator(
    [akun("a", { gmvPeriode: 100 })],
    [{ accountId: "a", upload: 2, komisi: null }],
    new Map([["a", 10]]),
  );
  const [a, b] = denganPembanding(sekarang, lalu);
  assert.deepEqual(a.sebelum, { gmv: 100, komisi: 10, upload: 2 });
  assert.deepEqual(b.sebelum, { gmv: 0, komisi: 0, upload: 0 });
});

test("urut 'Turun terbanyak' menaruh penurunan GMV terdalam di atas; Baru/— di bawah", () => {
  const baris = denganPembanding(
    barisAkunAffiliator(
      [
        akun("naik", { gmvPeriode: 150 }),
        akun("turun-dikit", { gmvPeriode: 90 }),
        akun("turun-banyak", { gmvPeriode: 20 }),
        akun("baru", { gmvPeriode: 10 }),
      ],
      [],
    ),
    barisAkunAffiliator(
      [
        akun("naik", { gmvPeriode: 100 }),
        akun("turun-dikit", { gmvPeriode: 100 }),
        akun("turun-banyak", { gmvPeriode: 100 }),
      ],
      [],
    ),
  );
  assert.deepEqual(
    urutkanAkun(baris, "perubahanGmv", "naik").map((b) => b.id),
    ["turun-banyak", "turun-dikit", "naik", "baru"],
  );
});
