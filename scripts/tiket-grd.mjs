#!/usr/bin/env node
/**
 * Membuat tiket di modul Tugas dari tonggak rencana operasional GRD.
 *
 * Tiket dari GRD baru otomatis dibuat setiap kali file GRD diimpor
 * (`impor-grd.mjs`). Skrip ini untuk dua keadaan lain:
 *
 *   · GRD yang SUDAH diimpor sebelum fitur ini ada (mis. Oktober 2026) —
 *     tiketnya dibuat sekali di sini;
 *   · memeriksa keadaan sebuah bulan kapan saja: berapa tiket yang masih
 *     akan dibuat dan tonggak mana yang dilewati.
 *
 * Tanpa --terapkan, skrip hanya MELAPORKAN (uji coba): berapa tiket yang
 * akan dibuat, untuk siapa, dari siapa, dan tonggak mana yang dilewati
 * beserta alasannya. Tidak ada yang tersimpan dan tidak ada notifikasi.
 * Dengan --terapkan, tiketnya dibuat. Aman diulang: tonggak yang sudah
 * bertiket tidak dibuatkan lagi.
 *
 * Aturan pembuatannya ada di database (`buat_tiket_grd`, migrasi 0201);
 * skrip ini hanya memanggilnya dan menuliskan hasilnya.
 *
 * Pemakaian (dari akar repo):
 *   npm run grd:tiket                      # uji coba bulan berjalan
 *   npm run grd:tiket -- --bulan=2026-10   # uji coba Oktober 2026
 *   npm run grd:tiket -- --bulan=2026-10 --terapkan
 *   npm run grd:tiket -- --bulan=2026-10 --rinci   # + daftar tiket satu per satu
 *
 * Kredensial dari .env.local, tidak dicetak.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { hariIniWib } from "@/lib/format";
import { susunLaporanTiketGrd } from "@/lib/tiket-grd";

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

const bulan = argumen.get("bulan") ?? argumen.get("periode") ?? hariIniWib().slice(0, 7);
if (!/^\d{4}-\d{2}(-01)?$/.test(bulan)) {
  console.error(`Bulan harus berbentuk YYYY-MM, mis. 2026-10 (diberi: ${bulan}).`);
  process.exit(2);
}
const PERIODE = `${bulan.slice(0, 7)}-01`;
const TERAPKAN = argumen.get("terapkan") === "true";
const RINCI = argumen.get("rinci") === "true";

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

const { data, error } = await sb.rpc("buat_tiket_grd", {
  p_periode: PERIODE,
  p_uji: !TERAPKAN,
});

if (error) {
  console.error(`✗ Database menolak: ${error.message}`);
  if (/buat_tiket_grd/.test(error.message) && /does not exist|Could not find/i.test(error.message)) {
    console.error(
      "  Migrasi 0199–0202 belum dijalankan di database ini. Jalankan migrasinya dulu.",
    );
  }
  process.exit(1);
}

const dir = path.join(AKAR, ".tmp", "grd");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, `tiket-${PERIODE.slice(0, 7)}.json`),
  JSON.stringify(data, null, 2) + "\n",
);

console.log(susunLaporanTiketGrd(data, { rinci: RINCI }).join("\n"));
console.log("");
if (!TERAPKAN) {
  console.log("✓ Uji coba selesai; tidak ada yang tersimpan.");
  if (data.dibuat > 0) {
    console.log("  Jalankan lagi dengan --terapkan untuk membuat tiketnya.");
  }
} else {
  console.log(`✓ ${data.dibuat} tiket dibuat.`);
  console.log(
    "  Penerima mendapat satu notifikasi ringkasan; tiket yang sudah lewat tenggat tidak memicu pengingat massal.",
  );
}
console.log(
  `  Laporan lengkap: ${path.relative(AKAR, path.join(dir, `tiket-${PERIODE.slice(0, 7)}.json`))}`,
);
