/**
 * Pemeriksaan parameter tool.
 *
 * Semua parameter diperiksa DI SINI sebelum menyentuh database, lalu
 * dikirim sebagai parameter query ($1, $2) — tidak pernah disambung ke
 * teks SQL. Objeknya `strict`: kunci yang tidak dikenal ditolak, supaya
 * salah ketik nama parameter tidak diam-diam diabaikan.
 */
import * as z from "zod/v4";

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/** Benar bila teks adalah tanggal kalender yang sungguh ada (bukan 2026-02-30). */
export function tanggalNyata(teks) {
  if (!POLA_TANGGAL.test(teks)) return false;
  const [t, b, h] = teks.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h));
  return d.getUTCFullYear() === t && d.getUTCMonth() === b - 1 && d.getUTCDate() === h;
}

export const tanggal = z
  .string()
  .refine(tanggalNyata, "Tanggal harus berformat YYYY-MM-DD dan benar-benar ada di kalender");

// Waktu wajib menyebut zona (+07:00 atau Z) supaya tidak ada tebakan
// "jam berapa di mana".
const POLA_WAKTU = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;

export const waktu = z
  .string()
  .refine(
    (s) => POLA_WAKTU.test(s) && tanggalNyata(s.slice(0, 10)) && !Number.isNaN(Date.parse(s)),
    "Waktu harus berformat YYYY-MM-DDTHH:MM+07:00 (zona wajib ditulis)",
  );

/** Selisih hari kalender antara dua tanggal YYYY-MM-DD. */
export function selisihHari(dari, sampai) {
  const ke = (s) => Date.UTC(...s.split("-").map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  return Math.round((ke(sampai) - ke(dari)) / 86_400_000);
}

/** Batas rentang `asisten.gmv_harian` (0217). Database tetap penjaga terakhirnya. */
export const MAKS_RENTANG_HARI = 92;
