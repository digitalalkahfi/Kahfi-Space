/**
 * Aturan antrean pengiriman WhatsApp.
 *
 * Murni — tanpa jaringan, tanpa basis data — supaya keputusan "kapan
 * dicoba lagi" bisa diuji tanpa menunggu waktu nyata berlalu.
 */

/** Jeda sebelum percobaan ke-n, dalam menit. */
const JEDA_MENIT = [0, 5, 30];

/**
 * Berapa lama menunggu sebelum percobaan berikutnya.
 *
 * Mundur bertahap: 5 menit, lalu 30. Gateway yang sedang tumbang
 * biasanya pulih dalam hitungan menit, dan mencoba tiap detik hanya
 * memperberatnya justru saat ia sedang kepayahan.
 */
export function jedaPercobaanMenit(percobaanKe: number): number {
  return JEDA_MENIT[Math.min(percobaanKe, JEDA_MENIT.length - 1)] ?? 30;
}

export type CalonKirim = {
  id: string;
  percobaan: number;
  /** Kapan percobaan terakhir dilakukan; null bila belum pernah. */
  terakhirPada: string | null;
};

/**
 * Apakah baris ini layak dicoba SEKARANG.
 *
 * Tiga hal diperiksa: belum melewati batas percobaan, dan jeda sejak
 * percobaan terakhir sudah lewat. Yang belum pernah dicoba selalu
 * layak.
 */
export function layakDicoba(
  c: CalonKirim,
  sekarang: Date,
  maksPercobaan: number,
): boolean {
  if (c.percobaan >= maksPercobaan) return false;
  if (c.terakhirPada === null) return true;

  const jeda = jedaPercobaanMenit(c.percobaan) * 60_000;
  return sekarang.getTime() - Date.parse(c.terakhirPada) >= jeda;
}

/**
 * Urutan pengerjaan: yang paling lama menunggu didahulukan.
 *
 * Bukan yang paling sedikit percobaannya. Notifikasi yang tertahan
 * sejak pagi lebih mendesak daripada yang baru masuk semenit lalu,
 * berapa kali pun masing-masing sudah dicoba.
 */
export function urutkanAntrean<T extends { dibuatPada: string }>(
  daftar: T[],
): T[] {
  return [...daftar].sort((a, b) => a.dibuatPada.localeCompare(b.dibuatPada));
}
