import { NextResponse, type NextRequest } from "next/server";
import { klienServer } from "@/lib/supabase/server";
import { jalurAman } from "@/lib/rute";
import { tujuanGalatGoogle } from "@/lib/pendaftaran";

/**
 * Tujuan kembali dari Google (OAuth PKCE).
 *
 * Dipakai dua alur:
 *  - "Masuk dengan Google" di /masuk — kodenya ditukar menjadi sesi.
 *  - "Sambungkan Google" di /profil (`linkIdentity`) — Google ditempelkan
 *    ke akun yang SAMA, lalu kembali ke profil.
 *
 * Sesudahnya middleware yang menentukan ke mana orang itu boleh pergi:
 * anggota aktif ke tujuannya, pendaftar baru ke /menunggu.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const lanjut = jalurAman(url.searchParams.get("lanjut"));
  const galat =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const alihkan = (jalur: string, pesan?: string) => {
    const tujuan = url.clone();
    tujuan.pathname = jalur;
    tujuan.search = "";
    if (pesan) tujuan.searchParams.set("galat_google", pesan);
    return NextResponse.redirect(tujuan);
  };

  if (galat) return alihkan(tujuanGalatGoogle(lanjut), galat);

  const kode = url.searchParams.get("code");
  if (!kode) return alihkan("/masuk", "Kode masuk dari Google tidak ada.");

  const sb = await klienServer();
  const { error } = await sb.auth.exchangeCodeForSession(kode);
  if (error) return alihkan(tujuanGalatGoogle(lanjut), error.message);

  return alihkan(lanjut);
}
