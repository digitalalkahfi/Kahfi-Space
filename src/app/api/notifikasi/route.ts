import { NextResponse, type NextRequest } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { daftarNotifikasi, jumlahBelumDibacaSaya } from "@/lib/data/notifikasi";
import {
  KATEGORI_NOTIFIKASI,
  hitungPerKategori,
  saringNotifikasi,
  type KategoriNotifikasi,
} from "@/lib/notifikasi";

/**
 * Daftar notifikasi pemanggil, sebagai JSON.
 *
 * Halaman `/notifikasi` tidak memerlukannya — ia server component.
 * Endpoint ini untuk yang di luar halaman: lencana pada pekerja latar,
 * dan nanti pengirim WhatsApp yang perlu tahu apa yang belum sampai.
 *
 * Selalu milik PEMANGGIL. Tidak ada parameter id atau email — bukan
 * karena lupa, melainkan karena kotak masuk orang lain bukan sesuatu
 * yang boleh dibaca dengan menebak URL. RLS menolaknya juga
 * (`notifikasi_baca_milik_sendiri`, migrasi 0111), tapi endpoint yang
 * menawarkan parameternya sudah salah sejak bentuknya.
 */
export async function GET(request: NextRequest) {
  const pengguna = await sesiSaatIni();
  if (!pengguna) {
    return NextResponse.json(
      { pesan: "Silakan masuk lebih dulu." },
      { status: 401 },
    );
  }

  const p = request.nextUrl.searchParams;

  const kategoriDiminta = p.get("kategori");
  if (
    kategoriDiminta !== null &&
    !(KATEGORI_NOTIFIKASI as readonly string[]).includes(kategoriDiminta)
  ) {
    return NextResponse.json(
      {
        pesan: `Kategori "${kategoriDiminta}" tidak dikenal. Pilihannya: ${KATEGORI_NOTIFIKASI.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const belumSaja = p.get("belum");
  if (belumSaja !== null && belumSaja !== "1" && belumSaja !== "0") {
    return NextResponse.json(
      { pesan: 'Parameter "belum" hanya menerima 0 atau 1.' },
      { status: 400 },
    );
  }

  const [semua, belumDibaca] = await Promise.all([
    daftarNotifikasi(pengguna),
    jumlahBelumDibacaSaya(pengguna),
  ]);

  const saring = saringNotifikasi(semua, {
    kategori: (kategoriDiminta as KategoriNotifikasi | null) ?? "semua",
    hanyaBelumDibaca: belumSaja === "1",
  });

  return NextResponse.json(
    {
      // Hitungan yang belum dibaca datang dari basis data, bukan dari
      // panjang daftar: daftarnya dibatasi, lencananya tidak boleh.
      belumDibaca,
      jumlah: saring.length,
      perKategori: hitungPerKategori(semua),
      notifikasi: saring,
    },
    {
      headers: {
        // Kotak masuk seseorang tidak boleh mengendap di cache bersama.
        "cache-control": "private, no-store",
      },
    },
  );
}
