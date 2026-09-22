/**
 * Bentuk balasan seragam untuk semua Server Action.
 * UI cukup memeriksa `ok` dan menampilkan `pesan` apa adanya.
 */
export type KodeGagal = "demo" | "izin" | "validasi" | "galat";

export type Hasil<T = undefined> =
  | { ok: true; data: T; pesan?: string }
  | { ok: false; pesan: string; kode: KodeGagal };

export function sukses<T>(data: T, pesan?: string): Hasil<T> {
  return { ok: true, data, pesan };
}

export function gagal(pesan: string, kode: KodeGagal = "galat") {
  return { ok: false as const, pesan, kode };
}

/** Balasan baku saat aplikasi berjalan tanpa Supabase. */
export const BALASAN_DEMO = gagal(
  "Mode demo: perubahan tidak disimpan. Hubungkan Supabase untuk menyimpan data.",
  "demo",
);
