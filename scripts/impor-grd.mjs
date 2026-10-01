#!/usr/bin/env node
/**
 * Impor GRD bulanan dari file Excel ke K-Space V2.
 *
 * Alur:
 *   1. File GRD dibaca menjadi rencana bernama (`src/lib/impor-grd.ts`).
 *   2. Nama orang dan akun dipetakan lewat berkas pemetaan yang disetujui
 *      pemilik — tidak ada tebakan otomatis. Nama yang belum tercantum
 *      menghentikan impor; yang sengaja null dilaporkan dan dilewati.
 *   3. Rencana ber-id dikirim ke `impor_grd` (migrasi 0190): seluruhnya
 *      dalam satu transaksi.
 *
 * Tanpa --terapkan, impor dijalankan sebagai UJI COBA: database
 * memeriksa seluruh rencana dengan aturan yang sama lalu membatalkannya.
 *
 * Pemakaian (dari akar repo):
 *   node --import ./scripts/alias-ts.mjs scripts/impor-grd.mjs
 *   node --import ./scripts/alias-ts.mjs scripts/impor-grd.mjs --terapkan
 *   … --sumber=docs/grd/GOALS-NOVEMBER-2026.xlsx --pemetaan=docs/grd/pemetaan-2026-11.json
 *
 * File GRD dan berkas pemetaan berisi nama dan angka internal: keduanya
 * hanya disimpan lokal (docs/grd/*.xlsx, docs/grd/pemetaan-*.json
 * dikecualikan .gitignore). Kredensial dari .env.local, tidak dicetak.
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { bacaRencanaGrd, susunRencana } from "@/lib/impor-grd";

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
  argumen.get("sumber") ?? "docs/grd/GOALS-OKTOBER-2026-revisi_1.xlsx",
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
  accounts: await ambil("accounts", "id, username"),
  units: await ambil("units", "id, kode"),
  goalLama: await ambil("goals", "id, judul, periode", (q) =>
    q.is("kode", null),
  ),
};

// ---------------------------------------------------------------------
// Pemetaan: tanpa berkas, dibuatkan usulan berisi padanan persis saja.
// ---------------------------------------------------------------------
if (!fs.existsSync(PEMETAAN)) {
  const persisOrang = new Map(
    data.users.map((u) => [u.nama.toLowerCase(), u.nama]),
  );
  const persisAkun = new Map(
    data.accounts.map((a) => [a.username.toLowerCase(), a.username]),
  );
  const orang = [
    ...new Set([
      ...mentah.goals.map((g) => g.pemilik),
      ...mentah.ukuran.map((u) => u.pic),
      ...mentah.lembar.map((l) => l.orang),
    ]),
  ].filter(Boolean);
  const akun = [
    ...new Set([
      ...mentah.goals.map((g) => g.akun),
      ...mentah.ukuran.flatMap((u) => u.lingkup.map((l) => l.akun)),
    ]),
  ].filter(Boolean);
  const usulan = {
    _catatan:
      "Usulan otomatis berisi padanan persis saja. Periksa SETIAP baris: isi nama/username " +
      "persis seperti di K-Space, atau null bila orang/akunnya belum terdaftar.",
    orang: Object.fromEntries(
      orang.map((n) => [n, persisOrang.get(n.toLowerCase()) ?? null]),
    ),
    akun: Object.fromEntries(
      akun.map((n) => [n, persisAkun.get(n.toLowerCase()) ?? null]),
    ),
    struktur: [],
    hapus_goal_periode: [],
  };
  fs.mkdirSync(path.dirname(PEMETAAN), { recursive: true });
  fs.writeFileSync(PEMETAAN, JSON.stringify(usulan, null, 2) + "\n");
  console.log(
    `Berkas pemetaan belum ada; usulannya ditulis ke ${path.relative(AKAR, PEMETAAN)}.`,
  );
  console.log("Periksa dan lengkapi berkas itu, lalu jalankan skrip ini lagi.");
  process.exit(1);
}

const pemetaan = JSON.parse(fs.readFileSync(PEMETAAN, "utf8"));
const { rencana, laporan } = susunRencana(mentah, pemetaan, data);

// ---------------------------------------------------------------------
// Laporan sebelum diterapkan
// ---------------------------------------------------------------------
console.log(
  `GRD ${mentah.periodeLabel} (${mentah.periode}) dari ${path.relative(AKAR, SUMBER)}`,
);
console.log(
  `  ${rencana.goals.length} goal · ${rencana.ukuran.length} ukuran · ` +
    `${rencana.lembar.length} lembar KPI · ${rencana.struktur.length} penyesuaian struktur`,
);
if (laporan.goalLamaDihapus.length) {
  console.log(`\nGoal lama yang dihapus (${laporan.goalLamaDihapus.length}):`);
  for (const g of laporan.goalLamaDihapus) console.log(`  - ${g}`);
}
if (laporan.tidakDitemukan.length) {
  console.log(
    `\nBelum terdaftar di K-Space (${laporan.tidakDitemukan.length}):`,
  );
  for (const t of laporan.tidakDitemukan) console.log(`  - ${t}`);
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

const DIR = path.join(AKAR, ".tmp", "grd");
fs.mkdirSync(DIR, { recursive: true });
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
