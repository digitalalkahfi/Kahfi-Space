import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PEMETAAN_V1 } from "@/lib/pemetaan-v1";
import { medanTakTerpetakan, versiPemetaan } from "@/lib/pemetaan";
import { KUNCI_DIKENAL, golonganKunci, medanEkspor } from "@/lib/ekspor-v1";

const contoh = JSON.parse(
  readFileSync("supabase/migrasi/ekspor-contoh.json", "utf8"),
) as Record<string, unknown>;

test("setiap kelompok memetakan kunci ekspor yang memang dikenali", () => {
  for (const p of PEMETAAN_V1) {
    assert.equal(
      golonganKunci(p.kunci),
      "dikenal",
      `kunci ${p.kunci} tidak ada di daftar kunci yang dipetakan`,
    );
  }
  // Tidak ada kelompok kembar; persetujuan dikunci per kunci.
  assert.equal(
    new Set(PEMETAAN_V1.map((p) => p.kunci)).size,
    PEMETAAN_V1.length,
  );
});

test("kolom tujuan tidak ditulis dua kali dalam satu kelompok", () => {
  // Dua baris menuju kolom yang sama berarti salah satunya diam-diam
  // menimpa yang lain, dan tidak ada yang tahu yang mana.
  for (const p of PEMETAAN_V1) {
    const per = new Map<string, number>();
    for (const b of p.baris)
      per.set(b.kolomBaru, (per.get(b.kolomBaru) ?? 0) + 1);

    for (const [kolom, jumlah] of per) {
      if (jumlah === 1) continue;
      // Kolom yang memang menampung gabungan beberapa medan lama boleh
      // muncul lebih dari sekali — asalkan setiap barisnya menyatakannya.
      const baris = p.baris.filter((b) => b.kolomBaru === kolom);
      assert.ok(
        baris.every((b) => b.gabung),
        `kelompok ${p.kunci} memetakan ${kolom} lebih dari sekali tanpa menyatakannya sebagai gabungan`,
      );
    }
  }
});

test("kolom kata sandi disebut sebagai dibuang, bukan didiamkan", () => {
  const orang = PEMETAAN_V1.find((p) => p.kunci === "users:list");
  assert.ok(orang);

  const dibuang = orang.dibuang.map((d) => d.medanLama);
  for (const medan of ["passwordHash", "password", "salt", "confirmPassword"]) {
    assert.ok(
      dibuang.includes(medan),
      `${medan} harus tercatat dibuang supaya yang menyetujui melihatnya`,
    );
  }
  // Tidak boleh ada yang justru dipetakan ke kolom mana pun.
  for (const b of orang.baris) {
    assert.equal(/password|salt/i.test(b.medanLama ?? ""), false);
  }
});

test("medan target laporan dibuang, bukan disimpan sebagai realisasi", () => {
  const laporan = PEMETAAN_V1.find((p) => p.kunci === "daily-reports:all");
  assert.ok(laporan);
  assert.ok(laporan.dibuang.some((d) => d.medanLama.startsWith("Target ")));
  assert.equal(
    laporan.baris.some((b) => (b.medanLama ?? "").startsWith("Target ")),
    false,
  );
});

test("penanda autoSynced dibuang supaya GMV tidak terhitung dua kali", () => {
  const gmv = PEMETAAN_V1.find((p) => p.kunci === "gmv:daily");
  assert.ok(gmv);
  assert.ok(gmv.dibuang.some((d) => d.medanLama === "autoSynced"));
});

test("pemetaan inti menutupi medan yang ada di contoh ekspor", () => {
  // Medan yang muncul di data tapi tidak disebut pemetaan akan hilang
  // tanpa jejak; inilah yang menahannya.
  for (const p of PEMETAAN_V1) {
    const nilai = contoh[p.kunci];
    if (nilai === undefined) continue;
    const asing = medanTakTerpetakan(p, medanEkspor(nilai));
    assert.deepEqual(
      asing,
      [],
      `kelompok ${p.kunci} belum memetakan: ${asing.join(", ")}`,
    );
  }
});

test("versi pemetaan berubah begitu satu baris disunting", () => {
  const orang = PEMETAAN_V1.find((p) => p.kunci === "users:list");
  assert.ok(orang);
  const semula = versiPemetaan(orang);

  const disunting = {
    ...orang,
    baris: orang.baris.map((b) =>
      b.kolomBaru === "nama" ? { ...b, ubahan: "huruf-kecil" as const } : b,
    ),
  };
  assert.notEqual(versiPemetaan(disunting), semula);
});

test("kelompok inti adalah bagian dari kunci yang dikenali", () => {
  const dikenal = new Set(KUNCI_DIKENAL.map((k) => k.kunci));
  for (const p of PEMETAAN_V1) assert.ok(dikenal.has(p.kunci));
});
