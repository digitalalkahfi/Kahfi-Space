// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, wajibSupabase } from "./config";
import type { Database } from "./types";

/**
 * Klien Supabase untuk Server Component, Route Handler, dan Server Action.
 * Sesi dibaca dari cookie sehingga RLS berjalan atas nama pengguna yang login.
 */
export async function klienServer() {
  wajibSupabase();
  const jar = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (daftar) => {
        try {
          daftar.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          // Server Component tidak boleh menulis cookie; middleware yang
          // menyegarkan sesi, jadi kegagalan di sini aman diabaikan.
        }
      },
    },
  });
}
