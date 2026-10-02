"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";

/**
 * Mencatat capaian kumulatif sebuah ukuran GRD pada satu tanggal — mis.
 * AKTUAL Sabtu di kurva WRM: ukuran isian (seller, creator, peserta, …),
 * atau ukuran GMV yang belum ada di laporan harian (0198).
 *
 * Yang boleh ditentukan database (`boleh_isi_ukuran`, 0198): CEO/Manager,
 * atau Leader/Co-Leader untuk ukuran divisinya. Nilai null mengosongkan
 * catatan tanggal itu.
 */
export async function isiCapaianUkuran(input: {
  ukuranId: string;
  tanggal: string;
  nilai: number | null;
  catatan?: string;
}): Promise<Hasil> {
  if (!input.ukuranId) return gagal("Ukuran tidak dikenali.", "validasi");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tanggal)) {
    return gagal("Tanggal tidak sah.", "validasi");
  }
  if (
    input.nilai !== null &&
    (!Number.isFinite(input.nilai) || input.nilai < 0)
  ) {
    return gagal("Capaian harus angka 0 atau lebih.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  if (input.nilai === null) {
    const { error } = await sb
      .from("grd_ukuran_isian")
      .delete()
      .eq("ukuran_id", input.ukuranId)
      .eq("tanggal", input.tanggal);
    if (error) return gagal(`Gagal menghapus: ${error.message}`);
  } else {
    const { data, error } = await sb
      .from("grd_ukuran_isian")
      .upsert(
        {
          ukuran_id: input.ukuranId,
          tanggal: input.tanggal,
          nilai: input.nilai,
          catatan: input.catatan?.trim() ?? "",
        },
        { onConflict: "ukuran_id,tanggal" },
      )
      .select("id");
    if (error) {
      return error.code === "42501"
        ? gagal("Kamu tidak berwenang mencatat capaian ini.", "izin")
        : gagal(error.message, "validasi");
    }
    if (!data || data.length === 0) {
      return gagal("Kamu tidak berwenang mencatat capaian ini.", "izin");
    }
  }

  revalidatePath("/grd/kurva");
  revalidatePath("/grd/goal");
  revalidatePath("/grd");
  return sukses(undefined, "Capaian tersimpan.");
}
