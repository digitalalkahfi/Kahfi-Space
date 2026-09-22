import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseSiap } from "./config";
import type { Database } from "./types";

/** Halaman yang boleh dibuka tanpa sesi. */
const TERBUKA = ["/masuk", "/auth"];

export function jalurTerbuka(path: string) {
  return TERBUKA.some((t) => path === t || path.startsWith(`${t}/`));
}

/**
 * Menyegarkan sesi Supabase pada setiap permintaan dan menjaga pintu.
 *
 * Token Auth berumur pendek; tanpa penyegaran di middleware, Server
 * Component akan menemui sesi kedaluwarsa padahal pengguna masih aktif.
 * Server Component sendiri tidak boleh menulis cookie, jadi pembaruannya
 * memang harus terjadi di sini.
 *
 * Mode demo tidak punya kredensial sama sekali, jadi middleware ini
 * membiarkannya lewat — aplikasi tetap bisa ditinjau tanpa Supabase.
 */
export async function segarkanSesi(request: NextRequest) {
  if (!supabaseSiap()) return NextResponse.next({ request });

  let balasan = NextResponse.next({ request });

  const sb = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (daftar) => {
        daftar.forEach(({ name, value }) => request.cookies.set(name, value));
        balasan = NextResponse.next({ request });
        daftar.forEach(({ name, value, options }) =>
          balasan.cookies.set(name, value, options),
        );
      },
    },
  });

  // Harus `getUser()`, bukan `getSession()`: hanya getUser yang memeriksa
  // token ke server Auth, sehingga cookie palsu tidak lolos.
  const {
    data: { user },
  } = await sb.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && !jalurTerbuka(path)) {
    const tujuan = request.nextUrl.clone();
    tujuan.pathname = "/masuk";
    // Supaya pengguna kembali ke halaman yang tadi ia tuju setelah masuk.
    tujuan.searchParams.set("lanjut", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(tujuan);
  }

  if (user && path === "/masuk") {
    const tujuan = request.nextUrl.clone();
    tujuan.pathname = "/beranda";
    tujuan.search = "";
    return NextResponse.redirect(tujuan);
  }

  return balasan;
}
