/**
 * Aturan murni foto selfie absensi. Tanpa impor server maupun klien.
 */

/** Sisi terpanjang foto yang disimpan: bukti wajah, tidak perlu besar. */
export const LEBAR_MAKS_SELFIE = 720;

/**
 * Foto dari kamera HP (jalur cadangan) dianggap baru bila diambil paling
 * lama sekian menit lalu. Berkas lebih tua kemungkinan besar dipilih dari
 * galeri, dan selfie lama bukan bukti kehadiran hari ini.
 */
export const BATAS_UMUR_FOTO_MENIT = 10;

/**
 * Ukuran kanvas untuk mengecilkan foto: sisi lebar dibatasi
 * `LEBAR_MAKS_SELFIE`, perbandingan sisi tetap. Foto yang sudah kecil
 * tidak diperbesar.
 */
export function ukuranKecil(
  lebar: number,
  tinggi: number,
  maks = LEBAR_MAKS_SELFIE,
): { lebar: number; tinggi: number } {
  if (lebar <= 0 || tinggi <= 0) return { lebar: 0, tinggi: 0 };
  const skala = Math.min(1, maks / lebar);
  return {
    lebar: Math.round(lebar * skala),
    tinggi: Math.round(tinggi * skala),
  };
}

/**
 * Berkas foto ini baru saja diambil. `diubahPada` adalah `File.lastModified`;
 * peramban yang tidak mengisinya (0) diberi manfaat keraguan, karena
 * menolak selfie sah lebih merugikan daripada sesekali meloloskan foto lama.
 */
export function fotoMasihBaru(
  diubahPada: number,
  sekarang: number,
  batasMenit = BATAS_UMUR_FOTO_MENIT,
): boolean {
  if (!diubahPada) return true;
  return sekarang - diubahPada <= batasMenit * 60_000;
}
