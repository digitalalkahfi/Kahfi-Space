import { NextResponse, type NextRequest } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { riwayatKirimSaya } from "@/lib/data/kirim-wa";
import {
  bacaSaringanKirim,
  bisaCobaLagi,
  ringkasKirim,
  samarkanNomor,
  saringKirim,
} from "@/lib/kirim-wa";

/**
 * Riwayat pengiriman WhatsApp pemanggil, sebagai JSON.
 *
 * Nomornya DISAMARKAN di sini juga, bukan hanya di layar. Jawaban JSON
 * berakhir di tempat yang tidak selalu terduga — konsol peramban, log
 * alat bantu, tangkapan layar saat menelusuri masalah — dan nomor
 * lengkap yang beredar di sana tidak bisa ditarik kembali.
 *
 * Cakupannya mengikuti RLS (`kirim_wa_baca_milik_sendiri`, migrasi
 * 0117): hanya pengiriman atas notifikasi milik pemanggil.
 */
export async function GET(request: NextRequest) {
  const pengguna = await sesiSaatIni();
  if (!pengguna) {
    return NextResponse.json(
      { pesan: "Silakan masuk lebih dulu." },
      { status: 401 },
    );
  }

  const diminta = request.nextUrl.searchParams.get("status");
  if (diminta !== null && !["antre", "terkirim", "gagal"].includes(diminta)) {
    return NextResponse.json(
      {
        pesan: `Status "${diminta}" tidak dikenal. Pilihannya: antre, terkirim, gagal.`,
      },
      { status: 400 },
    );
  }

  const semua = await riwayatKirimSaya(pengguna);
  const saring = saringKirim(semua, bacaSaringanKirim(diminta ?? undefined));

  return NextResponse.json(
    {
      ringkasan: ringkasKirim(semua),
      jumlah: saring.length,
      pengiriman: saring.map((p) => ({
        id: p.id,
        notifikasiId: p.notifikasiId,
        kategori: p.kategori,
        judul: p.judul,
        tujuan: samarkanNomor(p.tujuan),
        status: p.status,
        percobaan: p.percobaan,
        galat: p.galat,
        // Disertakan supaya pemanggil tidak menyalin aturan percobaan
        // ulang sendiri lalu melenceng dari yang benar-benar berlaku.
        akanDicobaLagi: bisaCobaLagi(p),
        dikirimPada: p.dikirimPada,
        dibuatPada: p.dibuatPada,
      })),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
