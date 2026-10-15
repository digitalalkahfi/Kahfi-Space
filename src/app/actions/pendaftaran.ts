"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { CATATAN_DAFTAR_MAKS, rapikanNoWa } from "@/lib/pendaftaran";

const KODE_UNIT = ["affiliator", "mcn", "tap"] as const;

/**
 * Calon anggota melengkapi pendaftarannya di /menunggu: No. WA (wajib),
 * divisi yang diajukan dan catatan (opsional). RLS (0209) hanya
 * mengizinkan baris miliknya sendiri selama masih menunggu, dan hanya
 * tiga kolom ini.
 */
export async function isiPendaftaran(input: {
  noWa: string;
  unitDiajukan: string | null;
  catatan: string;
}): Promise<Hasil> {
  const noWa = rapikanNoWa(input.noWa);
  if (!noWa) {
    return gagal(
      "Nomor WhatsApp tidak sah. Contoh yang benar: 0812 3456 7890.",
      "validasi",
    );
  }
  const unit =
    input.unitDiajukan &&
    (KODE_UNIT as readonly string[]).includes(input.unitDiajukan)
      ? input.unitDiajukan
      : null;
  const catatan = input.catatan.trim();
  if (catatan.length > CATATAN_DAFTAR_MAKS) {
    return gagal(
      `Catatan maksimal ${CATATAN_DAFTAR_MAKS} karakter.`,
      "validasi",
    );
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const { data, error } = await sb
    .from("pendaftaran_akun")
    .update({ no_wa: noWa, unit_diajukan: unit, catatan: catatan || null })
    .eq("id", user.id)
    .select("id");

  if (error) return gagal(`Gagal menyimpan: ${error.message}`);
  if (!data || data.length === 0) {
    return gagal(
      "Pendaftaranmu sudah diputuskan, jadi datanya tidak bisa diubah lagi.",
      "validasi",
    );
  }

  revalidatePath("/menunggu");
  return sukses(undefined, "Data pendaftaran terkirim.");
}
