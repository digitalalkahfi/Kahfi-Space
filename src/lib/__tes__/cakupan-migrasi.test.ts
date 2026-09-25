import { strict as assert } from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

/**
 * Tiap modul migrasi harus punya tesnya.
 *
 * Modul migrasi berumur pendek tetapi taruhannya besar: ia dipakai
 * sekali, pada data yang tidak bisa diambil ulang, dan kesalahannya
 * tidak menimbulkan galat — hanya angka yang keliru. Modul baru yang
 * ditambahkan tanpa tes adalah cara paling mudah kehilangan itu.
 */

/** Modul murni yang menjadi bagian alur migrasi V1. */
const MODUL = [
  "ekspor-v1",
  "pemetaan-v1",
  "laporan-v1",
  "izin-v1",
  "tugas-v1",
  "keuangan-v1",
  "peran-v1",
  "gmv-v1",
  "teks-v1",
  "pengumuman-v1",
  "agenda-v1",
  "masalah-v1",
  "masukan-v1",
  "sampel-v1",
  "lms-v1",
  "banding",
  "banding-v1",
  "rekap-pemetaan",
  "resolusi-orang",
  "impor",
  "kv-store",
];

test("tiap modul migrasi ada berkasnya", () => {
  for (const m of MODUL) {
    assert.ok(
      existsSync(`src/lib/${m}.ts`),
      `src/lib/${m}.ts disebut daftar tetapi tidak ada`,
    );
  }
});

test("tiap modul migrasi punya berkas tes", () => {
  const berkasTes = readdirSync("src/lib/__tes__");
  const isiTes = berkasTes
    .map((f) => readFileSync(`src/lib/__tes__/${f}`, "utf8"))
    .join("\n");

  for (const m of MODUL) {
    // Cukup diimpor di salah satu berkas tes: sebagian modul diuji
    // bersama modul lain yang memakainya, dan memaksa satu berkas per
    // modul hanya menghasilkan berkas yang isinya dipindah-pindah.
    assert.match(
      isiTes,
      new RegExp(`["/]${m}["']`),
      `modul ${m} tidak pernah diimpor satu pun berkas tes`,
    );
  }
});

test("tiap migrasi SQL migrasi V1 punya tes skemanya", () => {
  // Migrasi yang ditambahkan tanpa tes tidak ketahuan rusaknya sampai
  // ia dijalankan di basis data sungguhan.
  const sql = readdirSync("supabase/migrations").filter((f) =>
    /^01(5[2-9]|6[0-3])_/.test(f),
  );
  assert.ok(sql.length >= 10, `migrasi V1 terbaca: ${sql.length}`);

  const isiTes = readdirSync("supabase/tests")
    .map((f) => readFileSync(`supabase/tests/${f}`, "utf8"))
    .join("\n");

  // Yang diperiksa fungsinya, bukan nama berkasnya: satu berkas tes
  // boleh menguji beberapa migrasi sekaligus.
  for (const fungsi of [
    "golongan_kunci",
    "punya_kredensial",
    "medan_kunci_lama",
    "peta_id",
    "orang_v1",
    "ringkas_peta_kelompok",
    "gmv_unit_bulan",
    "migrasi_tulis_kehadiran",
    "migrasi_tulis_transaksi",
    "migrasi_tulis_laporan",
    "peta_menggantung",
    "ringkas_jalan_kelompok",
    "kehadiran_per_bulan",
    "kehadiran_per_orang",
  ]) {
    assert.match(
      isiTes,
      new RegExp(fungsi),
      `fungsi ${fungsi} tidak pernah diuji`,
    );
  }
});
