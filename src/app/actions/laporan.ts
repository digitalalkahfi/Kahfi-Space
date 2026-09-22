"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import type { KodeUnit } from "@/lib/types";

/** Batas atas yang sama dengan constraint di database. */
const MAKS_GMV = 100_000_000_000;

function periksaGmv(gmv: number): string | null {
  if (!Number.isFinite(gmv) || gmv < 0) return "Nilai GMV tidak sah.";
  if (gmv === 0) return "GMV belum diisi.";
  if (gmv > MAKS_GMV) return "Nilai GMV di luar batas wajar, periksa lagi.";
  return null;
}

/** Sasaran berbentuk "akun:<uuid>" atau "unit:<kode>". */
function uraikanSasaran(kunci: string) {
  const [jenis, nilai] = kunci.split(":");
  if (jenis !== "akun" && jenis !== "unit") return null;
  return { jenis, nilai } as const;
}

/**
 * Kirim laporan harian — satu-satunya tempat GMV masuk ke sistem.
 * Database memaksa satu laporan per (sasaran, tanggal).
 */
export async function kirimLaporanHarian(input: {
  sasaran: string;
  gmv: number;
  catatan?: string;
  tanggal: string;
}): Promise<Hasil<{ id: string }>> {
  const salah = periksaGmv(input.gmv);
  if (salah) return gagal(salah, "validasi");

  const sasaran = uraikanSasaran(input.sasaran);
  if (!sasaran) return gagal("Pilih akun atau unit dulu.", "validasi");

  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();

  let unitId: string | null = null;
  if (sasaran.jenis === "unit") {
    const { data } = await sb
      .from("units")
      .select("id")
      .eq("kode", sasaran.nilai as KodeUnit)
      .maybeSingle();
    if (!data) return gagal("Unit tidak dikenal.", "validasi");
    unitId = data.id;
  }

  const { data, error } = await sb
    .from("daily_reports")
    .insert({
      user_id: pengguna.id,
      tanggal: input.tanggal,
      account_id: sasaran.jenis === "akun" ? sasaran.nilai : null,
      unit_id: unitId,
      gmv: input.gmv,
      catatan: input.catatan?.trim() ?? "",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return gagal(
        "Laporan untuk sasaran ini hari ini sudah ada. Gunakan Perbaiki laporan.",
        "validasi",
      );
    }
    if (error.code === "42501") {
      return gagal("Kamu bukan penanggung jawab sasaran ini.", "izin");
    }
    return gagal(`Gagal menyimpan: ${error.message}`);
  }

  revalidatePath("/laporan-harian");
  revalidatePath("/beranda");
  return sukses({ id: data.id }, "Laporan harian terkirim.");
}

/**
 * Perbaiki angka GMV. Lewat RPC supaya alasan tercatat di jejak revisi
 * dalam satu transaksi — tidak ada jalan mengubah angka tanpa jejak.
 */
export async function perbaikiLaporan(input: {
  reportId: string;
  gmv: number;
  alasan: string;
  catatan?: string;
}): Promise<Hasil> {
  const salah = periksaGmv(input.gmv);
  if (salah) return gagal(salah, "validasi");
  if (input.alasan.trim().length < 10) {
    return gagal("Alasan perbaikan minimal 10 karakter.", "validasi");
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb.rpc("perbaiki_laporan_harian", {
    p_report_id: input.reportId,
    p_gmv: input.gmv,
    p_alasan: input.alasan.trim(),
    p_catatan: input.catatan?.trim() ?? null,
  });

  if (error) {
    return error.message.includes("bukan milikmu")
      ? gagal("Laporan ini bukan milikmu.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  revalidatePath("/laporan-harian");
  revalidatePath("/laporan-harian/riwayat");
  revalidatePath("/beranda");
  return sukses(undefined, "Perbaikan tersimpan beserta jejaknya.");
}
