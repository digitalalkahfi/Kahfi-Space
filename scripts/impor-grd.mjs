#!/usr/bin/env node
/**
 * Impor GRD bulanan dari file Excel ke K-Space V2.
 *
 * Alur:
 *   1. File GRD dibaca menjadi rencana bernama (`src/lib/impor-grd.ts`).
 *   2. Nama orang dan akun dicocokkan ke tabel anggota tim (`users`) dan
 *      akun (`accounts`) dengan aturan pasti (`lengkapiPemetaan`): nama
 *      persis, awal nama yang hanya cocok satu orang, atau PIC akun yang
 *      dipegangnya menurut file. Berkas pemetaan berisi pengecualian yang
 *      disetujui pemilik dan selalu menang. Yang tidak cocok TIDAK ditebak:
 *      dicatat sebagai "unmapped" (dicetak dan ditulis ke
 *      .tmp/grd/unmapped-YYYY-MM.json), lalu dilewati.
 *   3. Rencana ber-id dikirim ke `impor_grd` (migrasi 0190, 0195):
 *      seluruhnya dalam satu transaksi — goal, ukuran & kurva, lembar
 *      KPI, rencana operasional & tonggak, lead measure.
 *
 * Berkas pemetaan juga memuat `kpi_otomatis`: indikator KPI mana yang
 * dihitung otomatis dan dari mana (ukuran, tonggak, laporan harian, lead
 * measure). Formatnya dijelaskan di tipe `PemetaanGrd` (src/lib/impor-grd.ts).
 *
 * Tanpa --terapkan, impor dijalankan sebagai UJI COBA: database
 * memeriksa seluruh rencana dengan aturan yang sama lalu membatalkannya.
 *
 * Pemakaian (dari akar repo):
 *   node --import ./scripts/alias-ts.mjs scripts/impor-grd.mjs
 *   node --import ./scripts/alias-ts.mjs scripts/impor-grd.mjs --terapkan
 *   … --sumber=docs/GRD-NOVEMBER-2026.xlsx --pemetaan=docs/grd/pemetaan-2026-11.json
 *
 * File GRD dan berkas pemetaan berisi nama dan angka internal: keduanya
 * hanya disimpan lokal (docs/GRD-*.xlsx, docs/grd/pemetaan-*.json
 * dikecualikan .gitignore). Kredensial dari .env.local, tidak dicetak.
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import {
  bacaRencanaGrd,
  lengkapiPemetaan,
  susunRencana,
} from "@/lib/impor-grd";

XLSX.set_fs(fs);
const AKAR = path.resolve(import.meta.dirname, "..");

const argumen = new Map();
for (const a of process.argv.slice(2)) {
  const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
  if (!m) {
    console.error(`Argumen tidak dikenali: ${a}`);
    process.exit(2);
  }
  argumen.set(m[1], m[2] ?? "true");
}

const SUMBER = path.join(
  AKAR,
  argumen.get("sumber") ?? "docs/GRD-OKTOBER-2026.xlsx",
);
const TERAPKAN = argumen.get("terapkan") === "true";

if (!fs.existsSync(SUMBER)) {
  console.error(`File GRD tidak ditemukan: ${path.relative(AKAR, SUMBER)}`);
  process.exit(2);
}

const mentah = bacaRencanaGrd(XLSX.readFile(SUMBER, { cellNF: true }));
const PEMETAAN = path.join(
  AKAR,
  argumen.get("pemetaan") ??
    `docs/grd/pemetaan-${mentah.periode.slice(0, 7)}.json`,
);

// ---------------------------------------------------------------------
// Env — tidak pernah dicetak
// ---------------------------------------------------------------------
for (const nama of [".env.local", ".env"]) {
  const jalur = path.join(AKAR, nama);
  if (fs.existsSync(jalur)) {
    process.loadEnvFile(jalur);
    break;
  }
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KUNCI = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KUNCI) {
  console.error(
    "Butuh NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di env atau .env.local.",
  );
  process.exit(2);
}
const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });

async function ambil(tabel, kolom, saring) {
  let q = sb.from(tabel).select(kolom);
  if (saring) q = saring(q);
  const { data, error } = await q;
  if (error) throw new Error(`Gagal membaca ${tabel}: ${error.message}`);
  return data ?? [];
}

const data = {
  users: await ambil("users", "id, nama, status"),
  accounts: await ambil("accounts", "id, username, pic_user_id"),
  units: await ambil("units", "id, kode"),
  goalLama: await ambil("goals", "id, judul, periode", (q) =>
    q.is("kode", null),
  ),
};

// ---------------------------------------------------------------------
// Pemetaan: pengecualian dari berkas + pencocokan otomatis ke tabel tim
// ---------------------------------------------------------------------
const berkasAda = fs.existsSync(PEMETAAN);
const dasar = berkasAda
  ? JSON.parse(fs.readFileSync(PEMETAAN, "utf8"))
  : { orang: {}, akun: {} };
const cocok = lengkapiPemetaan(mentah, dasar, data);
const pemetaan = cocok.pemetaan;

const unmapped = {
  orang: cocok.orang
    .filter((o) => !o.ke)
    .map(({ nama, cara }) => ({ nama, cara })),
  akun: cocok.akun
    .filter((a) => !a.ke)
    .map(({ nama, cara }) => ({ nama, cara })),
};
const DIR = path.join(AKAR, ".tmp", "grd");
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(
  path.join(DIR, `unmapped-${mentah.periode.slice(0, 7)}.json`),
  JSON.stringify(unmapped, null, 2) + "\n",
);

if (!berkasAda) {
  // Tanpa berkas: tulis usulan dari hasil pencocokan supaya diperiksa dulu
  // (berkas juga memuat sumber otomatis KPI, struktur, dan papan).
  fs.mkdirSync(path.dirname(PEMETAAN), { recursive: true });
  fs.writeFileSync(
    PEMETAAN,
    JSON.stringify(
      {
        _catatan:
          "Usulan dari pencocokan otomatis ke tabel anggota tim. Periksa; null = unmapped.",
        orang: pemetaan.orang,
        akun: pemetaan.akun,
        struktur: [],
        hapus_goal_periode: [],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Berkas pemetaan belum ada; usulannya ditulis ke ${path.relative(AKAR, PEMETAAN)}.`,
  );
  console.log("Periksa dan lengkapi berkas itu, lalu jalankan skrip ini lagi.");
  process.exit(1);
}

const { rencana, laporan } = susunRencana(mentah, pemetaan, data);

// ---------------------------------------------------------------------
// Laporan sebelum diterapkan
// ---------------------------------------------------------------------
console.log(
  `GRD ${mentah.periodeLabel} (${mentah.periode}) dari ${path.relative(AKAR, SUMBER)}`,
);
const otomatis = [...cocok.orang, ...cocok.akun].filter(
  (c) => c.ke && c.cara !== "berkas pemetaan",
).length;
const dariBerkas = [...cocok.orang, ...cocok.akun].filter(
  (c) => c.ke && c.cara === "berkas pemetaan",
).length;
console.log(
  `  Nama: ${otomatis} cocok otomatis ke tabel tim · ${dariBerkas} dari berkas pemetaan · ` +
    `${unmapped.orang.length + unmapped.akun.length} unmapped`,
);
console.log(
  `  ${rencana.goals.length} goal · ${rencana.ukuran.length} ukuran · ` +
    `${rencana.lembar.length} lembar KPI · ${rencana.struktur.length} penyesuaian struktur`,
);
const nTonggak = rencana.rencana.reduce((t, r) => t + r.tonggak.length, 0);
const nOtomatis = rencana.lembar.reduce(
  (t, l) => t + l.indikator.filter((i) => i.sumber !== "manual").length,
  0,
);
const nIndikator = rencana.lembar.reduce((t, l) => t + l.indikator.length, 0);
console.log(
  `  ${rencana.rencana.length} rencana operasional · ${nTonggak} tonggak · ` +
    `${rencana.lead.length} lead measure · ${nOtomatis} dari ${nIndikator} indikator KPI otomatis`,
);
if (rencana.papan_kecuali) {
  console.log(
    `  ${rencana.papan_kecuali.length} akun dikecualikan dari papan akun leaderboard`,
  );
}
if (laporan.goalLamaDihapus.length) {
  console.log(`\nGoal lama yang dihapus (${laporan.goalLamaDihapus.length}):`);
  for (const g of laporan.goalLamaDihapus) console.log(`  - ${g}`);
}
if (unmapped.orang.length || unmapped.akun.length) {
  console.log(
    `\nUNMAPPED — tidak ada padanannya di tabel tim (${unmapped.orang.length} orang, ${unmapped.akun.length} akun):`,
  );
  for (const o of unmapped.orang)
    console.log(`  - orang "${o.nama}" (${o.cara})`);
  for (const a of unmapped.akun)
    console.log(`  - akun "${a.nama}" (${a.cara})`);
}
const lainTidakDitemukan = laporan.tidakDitemukan.filter(
  (t) => !/belum terdaftar di K-Space/.test(t),
);
if (lainTidakDitemukan.length) {
  console.log(`\nTidak ada di database (${lainTidakDitemukan.length}):`);
  for (const t of lainTidakDitemukan) console.log(`  - ${t}`);
}
if (laporan.dilewati.length) {
  console.log(`\nCatatan (${laporan.dilewati.length}):`);
  for (const t of laporan.dilewati) console.log(`  - ${t}`);
}
if (laporan.belumDipetakan.length) {
  console.error(
    `\nBelum ada di berkas pemetaan (${laporan.belumDipetakan.length}):`,
  );
  for (const t of laporan.belumDipetakan) console.error(`  - ${t}`);
  console.error("Tambahkan ke berkas pemetaan dulu. Tidak ada yang diimpor.");
  process.exit(1);
}

fs.writeFileSync(
  path.join(DIR, `rencana-${mentah.periode.slice(0, 7)}.json`),
  JSON.stringify(rencana, null, 2) + "\n",
);

const { data: hasil, error } = await sb.rpc("impor_grd", {
  p_rencana: rencana,
  p_uji: !TERAPKAN,
});

if (error) {
  const uji = /^UJI_COBA:(.*)$/s.exec(error.message);
  if (uji && !TERAPKAN) {
    console.log(
      "\n✓ Uji coba lulus seluruh aturan database; tidak ada yang tersimpan.",
    );
    console.log(`  Ringkasan: ${uji[1]}`);
    console.log("  Jalankan lagi dengan --terapkan untuk menyimpan.");
    process.exit(0);
  }
  console.error(`\n✗ Database menolak rencana: ${error.message}`);
  process.exit(1);
}

console.log(
  `\n✓ GRD ${mentah.periodeLabel} tersimpan: ${JSON.stringify(hasil)}`,
);
