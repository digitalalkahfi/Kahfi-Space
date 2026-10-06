/**
 * Rencana operasional GRD — aturan murni untuk layar (0192).
 *
 * Keadaan tonggak memakai aturan yang sama dengan `tonggak_tepat_waktu`:
 * tepat bila tanggal selesai (WIB) ≤ tenggat; tonggak yang tenggatnya
 * hari ini belum dianggap terlambat. Angka resmi KPI tetap dihitung
 * database — fungsi ini hanya untuk penanda di layar.
 */
import { keTanggalWib } from "@/lib/format";

export type StatusTonggak = "belum" | "progress" | "selesai";
export type JenisRencana = "sekali" | "harian" | "pekanan";

export type KeadaanTonggak =
  | "tepat"
  | "terlambat"
  /** Tenggat sudah lewat, belum selesai. */
  | "lewat"
  /** Belum jatuh tempo. */
  | "menunggu"
  | "tanpa_tenggat";

export type Tonggak = {
  id: string;
  kunci: string;
  judul: string;
  tenggat: string | null;
  status: StatusTonggak;
  selesaiPada: string | null;
  catatan: string;
  /**
   * Tonggak ini punya tiket di modul Tugas: statusnya hanya mengikuti
   * tiket, tidak diubah dari halaman Rencana (0199, 0202).
   */
  punyaTiket?: boolean;
  /** Id tiketnya, bila pemanggil boleh melihatnya (RLS tugas). */
  tiketId?: string | null;
};

export type Rencana = {
  id: string;
  kode: string;
  goalKode: string | null;
  goalJudul: string | null;
  indukKode: string;
  judul: string;
  jenis: JenisRencana;
  picTeks: string;
  picNama: string[];
  jadwalTeks: string;
  bolehCentang: boolean;
  tonggak: Tonggak[];
};

export const LABEL_STATUS: Record<StatusTonggak, string> = {
  belum: "Belum",
  progress: "Progress",
  selesai: "Selesai",
};

export const LABEL_JENIS: Record<JenisRencana, string> = {
  sekali: "Sekali",
  harian: "Harian",
  pekanan: "Pekanan",
};

export function keadaanTonggak(t: Tonggak, hariIni: string): KeadaanTonggak {
  if (!t.tenggat) return "tanpa_tenggat";
  if (t.status === "selesai" && t.selesaiPada) {
    return keTanggalWib(t.selesaiPada) <= t.tenggat ? "tepat" : "terlambat";
  }
  return t.tenggat < hariIni ? "lewat" : "menunggu";
}

export type RingkasTonggak = {
  jatuh: number;
  tepat: number;
  terlambat: number;
  lewat: number;
  menunggu: number;
  /** tepat / jatuh × 100; null bila belum ada yang jatuh tempo. */
  persen: number | null;
};

/** Ringkasan tonggak; "jatuh" = sudah lewat tenggatnya atau sudah selesai. */
export function ringkasTonggak(
  daftar: Tonggak[],
  hariIni: string,
): RingkasTonggak {
  const hasil = { jatuh: 0, tepat: 0, terlambat: 0, lewat: 0, menunggu: 0 };
  for (const t of daftar) {
    const k = keadaanTonggak(t, hariIni);
    if (k === "tanpa_tenggat") continue;
    if (k === "menunggu") {
      hasil.menunggu += 1;
      continue;
    }
    hasil.jatuh += 1;
    hasil[k] += 1;
  }
  return {
    ...hasil,
    persen: hasil.jatuh > 0 ? (hasil.tepat / hasil.jatuh) * 100 : null,
  };
}

/** Kelompok tampilan: per goal yang dilayani, tonggak Manager tersendiri. */
export function kelompokRencana(daftar: Rencana[]): {
  kunci: string;
  judul: string;
  rencana: Rencana[];
}[] {
  const peta = new Map<
    string,
    { kunci: string; judul: string; rencana: Rencana[] }
  >();
  for (const r of daftar) {
    const kunci = r.goalKode ?? r.indukKode;
    const judul = r.goalKode
      ? `${r.goalKode} · ${r.goalJudul ?? ""}`.trim()
      : r.indukKode === "M"
        ? "Tonggak Manager"
        : r.indukKode;
    const ada = peta.get(kunci);
    if (ada) ada.rencana.push(r);
    else peta.set(kunci, { kunci, judul, rencana: [r] });
  }
  return [...peta.values()];
}
