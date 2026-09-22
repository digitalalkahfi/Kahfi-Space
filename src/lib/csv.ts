/**
 * Penyusun CSV — murni, tanpa akses jaringan atau berkas.
 *
 * Pemisahnya titik koma, bukan koma: Excel berbahasa Indonesia memakai
 * koma sebagai pemisah desimal, sehingga berkas berkoma terbuka sebagai
 * satu kolom berantakan di mesin orang yang paling mungkin membukanya.
 */
export const PEMISAH_CSV = ";";

/** Membungkus sel yang memuat pemisah, tanda kutip, atau baris baru. */
export function selCsv(nilai: string | number | null | undefined): string {
  const teks = nilai === null || nilai === undefined ? "" : String(nilai);
  return /[";\r\n]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks;
}

export function barisCsv(kolom: (string | number | null | undefined)[]) {
  return kolom.map(selCsv).join(PEMISAH_CSV);
}

/**
 * Menyusun berkas CSV lengkap.
 *
 * Diakhiri CRLF dan diawali BOM: keduanya syarat agar Excel membaca
 * huruf beraksen dengan benar dan tidak menggabungkan baris terakhir.
 */
export function berkasCsv(baris: string[]) {
  return `﻿${baris.join("\r\n")}\r\n`;
}
