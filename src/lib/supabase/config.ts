/**
 * Konfigurasi koneksi Supabase.
 *
 * Aplikasi punya dua mode:
 *  - "supabase" — variabel lingkungan lengkap, data nyata dengan RLS.
 *  - "demo"     — belum ada kredensial; repositori memakai data contoh yang
 *                 sama dengan `supabase/seed.sql`, dan UI menandainya jelas.
 *
 * Mode demo ada supaya aplikasi tetap bisa dibuka dan ditinjau sebelum
 * proyek Supabase dibuat. Ia bukan jalur produksi: begitu env terisi,
 * seluruh repositori otomatis memakai database.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type ModeData = "supabase" | "demo";

export function modeData(): ModeData {
  return SUPABASE_URL && SUPABASE_ANON_KEY ? "supabase" : "demo";
}

export function supabaseSiap() {
  return modeData() === "supabase";
}

/** Dipakai di jalur yang benar-benar butuh database. */
export function wajibSupabase() {
  if (!supabaseSiap()) {
    throw new Error(
      "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local (lihat .env.example).",
    );
  }
}
