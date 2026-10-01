// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import type { Pengguna } from "@/lib/types";

export type TitikKurva = {
  tanggal: string;
  target: number;
  /** null = titik belum tiba, atau ukuran isian yang belum dicatat. */
  aktual: number | null;
  status: "hijau" | "merah" | null;
};

export type BarisKurva = {
  ukuranId: string;
  kode: string;
  judul: string;
  satuan: string;
  sumber: "gmv" | "isian";
  goalId: string | null;
  pic: string;
  bolehIsi: boolean;
  titik: TitikKurva[];
};

/**
 * Kurva WRM GRD satu periode (bulan): target kumulatif tiap Sabtu,
 * aktualnya, dan status HIJAU/MERAH — dari `kurva_grd` (0188), jadi
 * aturan HIJAU = aktual ≥ target hanya ada di satu tempat.
 *
 * Mode demo belum punya kurva; daftar kosong ditampilkan apa adanya.
 */
export async function kurvaGrd(
  _pengguna: Pengguna,
  periode: string,
  acuan: string,
): Promise<BarisKurva[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data, error } = await sb.rpc("kurva_grd", {
    p_periode: periode,
    p_acuan: acuan,
  });
  if (error) throw new Error(`Gagal memuat kurva GRD: ${error.message}`);

  return (data ?? []).map((k) => ({
    ukuranId: k.ukuran_id,
    kode: k.kode,
    judul: k.judul,
    satuan: k.satuan,
    sumber: k.sumber,
    goalId: k.goal_id,
    pic: k.pic,
    bolehIsi: k.boleh_isi,
    titik: ((k.titik as TitikKurva[] | null) ?? []).map((t) => ({
      tanggal: t.tanggal,
      target: Number(t.target),
      aktual: t.aktual === null ? null : Number(t.aktual),
      status: t.status,
    })),
  }));
}
