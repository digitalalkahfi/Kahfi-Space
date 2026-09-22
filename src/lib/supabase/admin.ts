// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";
import type { Database } from "./types";

/**
 * Klien service-role — MELEWATI RLS.
 *
 * Hanya untuk skrip administratif di server (seed, migrasi data lama,
 * pembuatan akun anggota tim). Jangan pernah diimpor dari komponen klien.
 */
export function klienAdmin() {
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !kunci) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY dan NEXT_PUBLIC_SUPABASE_URL wajib diisi " +
        "untuk operasi administratif.",
    );
  }
  return createClient<Database>(SUPABASE_URL, kunci, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
