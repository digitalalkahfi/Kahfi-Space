import { NextResponse } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehMigrasi } from "@/lib/data/migrasi";
import { bandingV1V2 } from "@/lib/data/banding";
import {
  ENTITAS_TAHAP_2,
  jumlahSelisih,
  jumlahTerhitung,
  nilaiBanding,
} from "@/lib/banding";

/**
 * Pembanding V1 vs V2 dalam bentuk angka, bukan tampilan.
 *
 * Layar verifikasi sudah menampilkannya. Yang tidak bisa dilakukan layar
 * adalah menjadi bukti: angka yang disalin dengan tangan dari layar
 * tidak bisa dibandingkan lagi minggu depan. Jalur ini membuat hasil
 * verifikasi bisa disimpan apa adanya sebelum dan sesudah migrasi.
 */
export async function GET() {
  const pengguna = await sesiSaatIni();
  if (!pengguna || !bolehMigrasi(pengguna)) {
    return NextResponse.json(
      {
        pesan: "Hanya CEO atau Manager yang boleh membaca verifikasi migrasi.",
      },
      { status: 403 },
    );
  }

  const kelompok = await bandingV1V2();

  return NextResponse.json(
    {
      diambilPada: new Date().toISOString(),
      ringkas: {
        terhitung: jumlahTerhitung(kelompok),
        berselisih: jumlahSelisih(kelompok),
      },
      kelompok: kelompok.map((k) => ({
        kunci: k.kunci,
        judul: k.judul,
        baris: k.baris.map((b) => {
          const nilai = nilaiBanding(b);
          return {
            ukuran: b.ukuran,
            satuan: b.satuan,
            v1: b.v1,
            v2: b.v2,
            selisih: nilai.selisih,
            status: nilai.status,
            keterangan: b.catatan ?? nilai.keterangan,
          };
        }),
      })),
      belumDimigrasi: ENTITAS_TAHAP_2,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
