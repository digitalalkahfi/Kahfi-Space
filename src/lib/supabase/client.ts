"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, wajibSupabase } from "./config";
import type { Database } from "./types";

let klien: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Klien Supabase untuk komponen browser; dibuat sekali lalu dipakai ulang. */
export function klienBrowser() {
  wajibSupabase();
  klien ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  return klien;
}
