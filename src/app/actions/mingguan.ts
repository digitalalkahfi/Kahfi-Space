"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";

/**
 * Bentuk laporan mingguan tiap unit dari data harian pekan itu.
 *
 * Berbeda dari penguncian KPI, laporan ini boleh dibentuk ulang: angka
 * harian masih bisa dikoreksi setelah pekannya lewat, dan keputusan WRM
 * harus ikut angka terbaru. Yang tidak boleh adalah membentuknya sebelum
 * pekannya selesai — separuh pekan selalu terbaca merah tanpa sebab.
 */
export async function buatLaporanMingguan(pekan: string): Promise<Hasil<number>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pekan)) {
    return gagal("Periode pekan tidak sah.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (pengguna.role !== "CEO" && pengguna.role !== "Manager") {
    return gagal(
      "Hanya CEO atau Manager yang boleh membentuk laporan mingguan.",
      "izin",
    );
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("buat_laporan_mingguan", {
    p_pekan: pekan,
  });

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak membentuk laporan mingguan.", "izin")
      : gagal(error.message, "validasi");
  }

  revalidatePath("/grd");
  revalidatePath("/grd/mingguan");

  const jumlah = Number(data ?? 0);
  return sukses(
    jumlah,
    jumlah > 0
      ? `Laporan ${jumlah} unit dibentuk dari data harian pekan itu.`
      : "Tidak ada unit yang bisa dilaporkan pekan itu.",
  );
}
