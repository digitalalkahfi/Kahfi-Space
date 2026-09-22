/**
 * Tipe & perhitungan KPI yang murni — tanpa impor server maupun klien,
 * sehingga aman dipakai Server Component sekaligus komponen browser.
 * Query-nya ada di `src/lib/data/kpi.ts`.
 */

export type SumberKpi = "gmv" | "lead_measure" | "absensi" | "tiket" | "manual";

export type PredikatKpi = "Istimewa" | "Baik" | "Cukup" | "Perlu Perbaikan";

export type DefinisiKpi = {
  id: string;
  jabatan: string;
  namaKpi: string;
  periode: string;
  bobot: number;
  satuan: string;
  skala: number;
  targetBase: number;
  targetGoal: number;
  targetStretch: number;
  sumberData: SumberKpi;
  /** Indikator nonaktif tetap terbawa saat dikelola, tidak ikut dinilai. */
  aktif: boolean;
};

export type RincianKpi = {
  nama: string;
  bobot: number;
  satuan: string;
  sumber: SumberKpi;
  /** null bila indikator ini tidak berlaku untuk orang tersebut. */
  realisasi: number | null;
  skor: number | null;
  berlaku: boolean;
};

export type BarisScorecard = {
  userId: string;
  nama: string;
  inisial: string;
  jabatan: string;
  unit: string;
  skor: number;
  predikat: PredikatKpi;
  /** Persentase bobot yang benar-benar dinilai; 100 berarti terukur penuh. */
  cakupan: number;
  rincian: RincianKpi[];
  terkunci: boolean;
};

export type RingkasScorecard = {
  rataRata: number;
  dinilai: number;
  parsial: number;
  total: number;
};

export const LABEL_SUMBER: Record<SumberKpi, string> = {
  gmv: "Laporan harian GMV",
  lead_measure: "Entri lead measure",
  absensi: "Catatan absensi",
  tiket: "Penyelesaian tugas & QC",
  manual: "Penilaian manual",
};

/** Ambang predikat — sama dengan fungsi `predikat_dari_skor` di database. */
export function predikatDariSkor(skor: number): PredikatKpi {
  if (skor >= 800) return "Istimewa";
  if (skor >= 650) return "Baik";
  if (skor >= 500) return "Cukup";
  return "Perlu Perbaikan";
}

/**
 * Padanan `skor_kpi` di database.
 * base → 500, goal → 800, stretch → 1.000, di antaranya lurus.
 */
export function skorKpi(
  realisasi: number,
  base: number,
  goal: number,
  stretch: number,
) {
  if (realisasi <= 0) return 0;
  let s: number;
  if (base <= 0) s = goal > 0 ? (realisasi / goal) * 800 : 0;
  else if (realisasi < base) s = (realisasi / base) * 500;
  else if (realisasi < goal)
    s = 500 + ((realisasi - base) / (goal - base)) * 300;
  else if (realisasi < stretch)
    s = 800 + ((realisasi - goal) / (stretch - goal)) * 200;
  else s = 1000;
  return Math.round(Math.min(1000, Math.max(0, s)) * 10) / 10;
}

/**
 * Ringkasan sekumpulan baris scorecard.
 *
 * Rata-rata sengaja hanya menghitung orang yang terukur penuh: skor dari
 * cakupan parsial bertumpu pada sebagian bobot saja, sehingga mencampurnya
 * membuat angka tim tidak berarti. Dihitung dari baris yang benar-benar
 * terlihat pemakai, bukan query terpisah, supaya ringkasan dan daftarnya
 * tidak pernah bercerita berbeda.
 */
export function ringkasScorecard(daftar: BarisScorecard[]): RingkasScorecard {
  const penuh = daftar.filter((b) => b.cakupan >= 100);
  return {
    rataRata:
      penuh.length > 0
        ? Math.round(penuh.reduce((a, b) => a + b.skor, 0) / penuh.length)
        : 0,
    dinilai: penuh.length,
    parsial: daftar.length - penuh.length,
    total: daftar.length,
  };
}
