"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import {
  anggaranBentrok,
  judulAnggaran,
  periksaAnggaran,
  type MasukanAnggaran,
} from "@/lib/budget";
import { daftarAnggaran } from "@/lib/data/budget";
import { bolehLihatKeuangan } from "@/lib/keuangan";

/**
 * Menetapkan atau membetulkan pagu anggaran.
 *
 * BELUM MENYIMPAN: tabel anggaran menyusul di lapisan backend Fase 3.
 * Yang dikerjakan di sini pemeriksaan isian, wewenang, dan bentrokan
 * pagu — dan balasannya menyebut batas itu apa adanya, sebab form yang
 * diam-diam tidak menyimpan apa pun jauh lebih merugikan daripada form
 * yang mengatakannya.
 */
export async function simpanAnggaran(
  input: MasukanAnggaran,
  anggaranId?: string,
): Promise<Hasil> {
  const salah = periksaAnggaran(input);
  if (salah) return gagal(salah, "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehLihatKeuangan(pengguna.role)) {
    return gagal(
      "Hanya Finance, Manager, atau CEO yang menetapkan anggaran.",
      "izin",
    );
  }

  const semua = await daftarAnggaran(pengguna);
  if (anggaranId && !semua.some((a) => a.id === anggaranId)) {
    return gagal("Anggaran tidak ditemukan.", "validasi");
  }
  if (anggaranBentrok(semua, input, anggaranId)) {
    return gagal(
      "Pos itu sudah punya pagu untuk periode ini. Betulkan pagunya, jangan tambah baris baru.",
      "validasi",
    );
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  revalidatePath("/keuangan/budget");

  const nama = judulAnggaran({
    ...input,
    id: anggaranId ?? "",
    unitNama: input.unitKode ?? "Perusahaan",
    disetujuiNama: null,
  });

  return sukses(
    undefined,
    `Isian anggaran ${nama} sudah sah, tetapi belum tersimpan: tabel anggaran menyusul di lapisan backend.`,
  );
}
