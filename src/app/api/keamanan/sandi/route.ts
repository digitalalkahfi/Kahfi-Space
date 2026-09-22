import { NextResponse, type NextRequest } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { gantiSandiPengguna } from "@/lib/data/keamanan";

/**
 * Mengganti kata sandi pemanggil lewat Supabase Auth.
 *
 * Aturannya tidak ditulis ulang di sini — `gantiSandiPengguna()` yang
 * sama dipakai form di halaman Keamanan. Endpoint ini ada supaya alur
 * lain (mis. layar "sandi kedaluwarsa" saat masuk, yang tidak punya
 * halaman Keamanan di depannya) tidak perlu menirukan urutan
 * pemeriksaannya sendiri dan berakhir lupa membuktikan sandi lama.
 *
 * POST, bukan PATCH atau GET: kata sandi tidak boleh pernah muncul di
 * URL — ia akan mengendap di riwayat peramban, log server, dan Referer.
 *
 * Hanya sandi MILIK PEMANGGIL; tidak ada parameter email atau id.
 */
export async function POST(request: NextRequest) {
  const pengguna = await sesiSaatIni();
  if (!pengguna) {
    return NextResponse.json(
      { pesan: "Silakan masuk lebih dulu." },
      { status: 401 },
    );
  }

  let badan: unknown;
  try {
    badan = await request.json();
  } catch {
    return NextResponse.json(
      { pesan: "Badan permintaan harus JSON." },
      { status: 400 },
    );
  }

  const teks = (kunci: string): string | null => {
    if (typeof badan !== "object" || badan === null || !(kunci in badan)) {
      return null;
    }
    const nilai = (badan as Record<string, unknown>)[kunci];
    return typeof nilai === "string" ? nilai : null;
  };

  const lama = teks("lama");
  const baru = teks("baru");
  const ulang = teks("ulang");

  if (lama === null || baru === null || ulang === null) {
    return NextResponse.json(
      { pesan: 'Sertakan medan "lama", "baru", dan "ulang" berupa teks.' },
      { status: 400 },
    );
  }

  const hasil = await gantiSandiPengguna(pengguna, lama, baru, ulang);

  const balasan = NextResponse.json(
    { ok: hasil.ok, pesan: hasil.pesan },
    {
      status: hasil.ok
        ? 200
        : hasil.kode === "validasi"
          ? 400
          : hasil.kode === "demo"
            ? 409
            : 401,
    },
  );
  balasan.headers.set("cache-control", "private, no-store");
  return balasan;
}
