import { NextResponse } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { jumlahBelumDibacaSaya } from "@/lib/data/notifikasi";
import { labelLencana } from "@/lib/notifikasi";

/**
 * Berapa notifikasi pemanggil yang belum dibaca.
 *
 * Sengaja dipisah dari `/api/notifikasi`: satu angka yang diminta
 * berkali-kali tidak boleh ikut menyeret seluruh daftarnya. Basis data
 * pun hanya menghitung — `head: true`, tanpa mengirim satu baris pun.
 *
 * Ini endpoint yang paling sering dipanggil di seluruh modul, jadi
 * bentuk jawabannya dijaga sekecil mungkin.
 */
export async function GET() {
  const pengguna = await sesiSaatIni();
  if (!pengguna) {
    return NextResponse.json(
      { pesan: "Silakan masuk lebih dulu." },
      { status: 401 },
    );
  }

  const jumlah = await jumlahBelumDibacaSaya(pengguna);

  return NextResponse.json(
    {
      jumlah,
      // Label siap pakai supaya pemanggil tidak menyalin aturan "99+"
      // sendiri-sendiri lalu melenceng satu sama lain.
      lencana: labelLencana(jumlah),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
