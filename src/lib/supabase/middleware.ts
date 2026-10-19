import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseSiap } from "./config";
import type { Database } from "./types";
import { harusGantiSandiDulu } from "@/lib/keamanan";
import { alihkanMenurutStatus } from "@/lib/pendaftaran";

/**
 * Halaman yang boleh dibuka tanpa sesi. `/privasi` wajib publik: Google
 * mensyaratkan tautan kebijakan privasi yang bisa dibuka siapa pun
 * sebelum login Google boleh dipakai di luar mode uji.
 */
const TERBUKA = ["/masuk", "/auth", "/privasi"];

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

  // Akun yang dibuat CEO/Manager memakai kata sandi sementara: pemiliknya
  // mengganti dulu di halaman Keamanan sebelum memakai K-Space.
  if (user && harusGantiSandiDulu(user.user_metadata, path)) {
    const tujuan = request.nextUrl.clone();
    tujuan.pathname = "/keamanan";
    tujuan.search = "?wajib=1";
    return NextResponse.redirect(tujuan);
  }

  // Gerbang anggota aktif (0208): akun tanpa profil aktif — pendaftar
  // Google yang menunggu persetujuan, yang ditolak, atau profil yang
  // dinonaktifkan — ditahan di layar /menunggu. Ini hanya kenyamanan;
  // penjaga sebenarnya RLS, yang menolak akun itu membaca apa pun.
  //
  // Bila status gagal dibaca (galat jaringan, atau kode terpasang sebelum
  // migrasi 0208), permintaan dibiarkan lewat: menahan SEMUA orang di
  // layar tunggu karena satu galat lebih merugikan, dan akun yang tidak
  // aktif tetap tidak membaca apa pun karena RLS.
  if (user) {
    const { data: status, error } = await sb.rpc("status_akses_saya");
    if (error) {
      console.error(`Status akses tidak terbaca: ${error.message}`);
      return balasan;
    }
    const alih = alihkanMenurutStatus(status ?? null, path);
    if (alih) {
      const tujuan = request.nextUrl.clone();
      tujuan.pathname = alih;
      tujuan.search = "";
      // Cookie sesi yang baru disegarkan ikut dibawa ke pengalihan.
      const ke = NextResponse.redirect(tujuan);
      balasan.cookies.getAll().forEach((c) => ke.cookies.set(c));
      return ke;
    }
  }

  return balasan;
}
