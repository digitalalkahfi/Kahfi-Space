import { NextResponse, type NextRequest } from "next/server";
import { prosesAntreanWa } from "@/lib/data/antrean-wa";
import { alasanBelumSiap, gatewaySiap } from "@/lib/gateway-wa";
import { modeData } from "@/lib/supabase/config";

/**
 * Menjalankan satu putaran antrean pengiriman WhatsApp.
 *
 * Inilah penghubung terakhirnya: peristiwa → notifikasi (trigger 0112)
 * → antrean (trigger 0117) → endpoint ini → gateway. Tanpa sesuatu yang
 * memanggilnya, antrean terisi selamanya tanpa pernah terkirim.
 *
 * DIJALANKAN PEKERJAAN TERJADWAL, bukan pengguna. Karena itu ia tidak
 * memakai sesi sama sekali — ia memakai rahasia bersama di header.
 * Endpoint yang bisa dipanggil pengguna mana pun berarti siapa pun bisa
 * memaksa seluruh antrean terkirim, atau menghabiskan kuota gateway
 * dengan memanggilnya berulang-ulang.
 *
 * Aman dipanggil berkali-kali: yang sudah terkirim tidak ikut terambil,
 * dan yang gagal punya jeda sebelum boleh dicoba lagi.
 */
export async function POST(request: NextRequest) {
  const rahasia = process.env.CRON_SECRET ?? "";

  // Tanpa rahasia yang dikonfigurasi, endpoint ini MATI — bukan
  // terbuka. Konfigurasi yang belum diisi tidak boleh berarti "semua
  // boleh masuk".
  if (!rahasia) {
    return NextResponse.json(
      {
        pesan: "CRON_SECRET belum diisi, jadi pemroses antrean dinonaktifkan.",
      },
      { status: 503 },
    );
  }

  const diberikan = request.headers.get("authorization") ?? "";
  if (diberikan !== `Bearer ${rahasia}`) {
    return NextResponse.json({ pesan: "Tidak diizinkan." }, { status: 401 });
  }

  if (modeData() === "demo") {
    return NextResponse.json(
      { pesan: "Mode demo: tidak ada antrean sungguhan untuk diproses." },
      { status: 409 },
    );
  }

  if (!gatewaySiap()) {
    // 503, bukan 500: ini keadaan konfigurasi yang bisa diperbaiki,
    // bukan kerusakan. Pemanggil terjadwal boleh mencoba lagi nanti.
    return NextResponse.json({ pesan: alasanBelumSiap() }, { status: 503 });
  }

  try {
    const hasil = await prosesAntreanWa();
    return NextResponse.json(hasil, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : String(e);
    console.error("Gagal memproses antrean WhatsApp:", pesan);
    return NextResponse.json(
      { pesan: "Pemrosesan antrean gagal; dicatat di log server." },
      { status: 500 },
    );
  }
}
