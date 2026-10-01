"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import type { StatusTonggak } from "@/lib/rencana";

const STATUS: StatusTonggak[] = ["belum", "progress", "selesai"];

/**
 * Mengubah status satu tonggak rencana operasional GRD.
 *
 * Siapa yang boleh dan kapan waktu selesai dicatat ditentukan database
 * (`ubah_status_tonggak`, `jaga_tonggak` — 0192): PIC di kolom SIAPA,
 * atasannya, atau CEO/Manager; waktu selesai = saat dicentang, WIB.
 */
export async function ubahStatusTonggak(input: {
  tonggakId: string;
  status: StatusTonggak;
}): Promise<Hasil> {
  if (!input.tonggakId) return gagal("Tonggak tidak dikenali.", "validasi");
  if (!STATUS.includes(input.status)) {
    return gagal("Status tonggak tidak dikenal.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { error } = await sb.rpc("ubah_status_tonggak", {
    p_tonggak: input.tonggakId,
    p_status: input.status,
  });
  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berwenang mengubah tonggak ini.", "izin")
      : gagal(error.message, "validasi");
  }

  revalidatePath("/grd/rencana");
  revalidatePath("/grd/scorecard");
  return sukses(undefined, "Status tonggak tersimpan.");
}
