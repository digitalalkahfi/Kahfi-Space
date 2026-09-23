import { NextResponse } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehMigrasi } from "@/lib/data/migrasi";

/**
 * Mengunduh contoh ekspor K-Space V1 yang ikut dalam repositori.
 *
 * Gunanya bukan sekadar pajangan: dengan berkas ini orang bisa mencoba
 * seluruh alur unggah — memilih berkas, melihat pratinjau isinya, sampai
 * pesan balasannya — tanpa menyentuh ekspor sungguhan yang memuat data
 * pribadi seluruh karyawan.
 *
 * Isinya data demo dan tidak memuat satu pun medan kata sandi, tetapi
 * tetap dijaga peran yang sama dengan layar migrasinya supaya tidak ada
 * dua pintu dengan aturan berbeda.
 */
export async function GET() {
  const pengguna = await sesiSaatIni();
  if (!pengguna || !bolehMigrasi(pengguna)) {
    return NextResponse.json(
      { pesan: "Hanya CEO atau Manager yang boleh mengambil contoh ekspor." },
      { status: 403 },
    );
  }

  const { default: berkas } =
    await import("../../../../../supabase/migrasi/ekspor-contoh.json");

  return new NextResponse(JSON.stringify(berkas, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="ekspor-contoh.json"',
      // Berkasnya ikut versi aplikasi; tidak ada gunanya disimpan lama.
      "cache-control": "no-store",
    },
  });
}
