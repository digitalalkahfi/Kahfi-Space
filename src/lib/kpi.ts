/**
 * Tipe & perhitungan KPI yang murni — tanpa impor server maupun klien,
 * sehingga aman dipakai Server Component sekaligus komponen browser.
 * Query-nya ada di `src/lib/data/kpi.ts`.
 */
import { angka, persen } from "@/lib/format";

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

/**
 * Rumus yang menilai sebuah bulan:
 * - "jabatan": indikator per jabatan, interpolasi base/goal/stretch (0024–0173);
 * - "grd": lembar KPI per orang, tangga 10 kolom file GRD (0187).
 */
export type MetodeKpi = "jabatan" | "grd";

/** Arah tangga GRD: makin besar makin baik, atau makin kecil makin baik. */
export type ArahTangga = "naik" | "turun";

/** Satu indikator lembar KPI GRD beserta penilaiannya. */
export type RincianGrd = {
  indikatorId: string;
  urutan: number;
  nama: string;
  /** "%" berarti pencapaian dan tangganya ditulis 0–100. */
  satuan: string;
  bobot: number;
  arah: ArahTangga;
  /** Ambang kolom 1–10; kolom 4 = BASE, 8 = GOAL, 9–10 = STRETCH. */
  tangga: number[];
  /**
   * PENCAPAIAN yang dinilai: isian penilai bila ada, selain itu angka
   * otomatis. null = belum ada keduanya; bernilai 0.
   */
  pencapaian: number | null;
  /** "manual" atau sumber otomatisnya (0194). */
  sumber: string;
  /** Penjelasan sumber otomatis, mis. "Otomatis: tonggak tepat waktu (…)". */
  keteranganSumber: string;
  /** Isian penilai; menang atas angka otomatis. */
  manual: number | null;
  /** Angka otomatis dari data aplikasi; null bila belum ada data. */
  otomatis: number | null;
  /** VALUE 0–10. */
  nilai: number;
  /** VALUE × bobot. */
  total: number;
};

type DasarBaris = {
  userId: string;
  nama: string;
  inisial: string;
  jabatan: string;
  unit: string;
  skor: number;
  /** Persentase bobot yang benar-benar dinilai; 100 berarti terukur penuh. */
  cakupan: number;
  terkunci: boolean;
};

export type BarisScorecard =
  | (DasarBaris & {
      metode: "jabatan";
      predikat: PredikatKpi;
      rincian: RincianKpi[];
    })
  | (DasarBaris & {
      metode: "grd";
      /** null = "BELUM DIISI": belum satu pun pencapaian diisi. */
      predikat: PredikatKpi | null;
      rincian: RincianGrd[];
      /** Pembaca adalah penilai orang ini dan bulannya belum terkunci. */
      bolehMenilai: boolean;
      /** Lembar usulan (draft) yang menunggu disahkan, bila belum ada yang aktif. */
      lembarUsulan: { id: string; judul: string } | null;
    });

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

// ---------------------------------------------------------------------
// KPI GRD — tangga 10 kolom (migrasi 0187; sheet KPI di file GRD bulanan)
// ---------------------------------------------------------------------

/** Banyak kolom tangga GRD. Kolom 4 = BASE, 8 = GOAL, 9–10 = STRETCH. */
export const KOLOM_TANGGA = 10;

/**
 * VALUE GRD satu indikator, 0–10: banyaknya kolom tangga yang sudah
 * dilampaui. Arah naik persis `COUNTIF(C:L,"<="&M)` di file GRD; arah
 * turun menghitung kolom yang angkanya ≥ pencapaian. Kosong bernilai 0,
 * sama dengan `IF(M="",0,…)`. Padanan `nilai_tangga` di database.
 */
export function nilaiTangga(
  pencapaian: number | null,
  tangga: readonly number[],
  arah: ArahTangga = "naik",
): number {
  if (pencapaian === null || !Number.isFinite(pencapaian)) return 0;
  return tangga.filter((t) =>
    arah === "turun" ? t >= pencapaian : t <= pencapaian,
  ).length;
}

export type IndikatorLembar = {
  bobot: number;
  tangga: readonly number[];
  arah: ArahTangga;
  pencapaian: number | null;
};

/**
 * NILAI KPI satu lembar — padanan `hitung_kpi_grd`.
 *
 * total    = Σ VALUE × bobot; yang kosong tetap ikut dengan VALUE 0.
 * predikat = null ("BELUM DIISI") bila belum satu pun pencapaian diisi.
 * cakupan  = persentase bobot yang sudah diisi, sekadar keterangan.
 */
export function hitungLembarKpi(indikator: readonly IndikatorLembar[]): {
  total: number;
  predikat: PredikatKpi | null;
  cakupan: number;
} {
  let total = 0;
  let bobot = 0;
  let terisi = 0;
  for (const i of indikator) {
    total += nilaiTangga(i.pencapaian, i.tangga, i.arah) * i.bobot;
    bobot += i.bobot;
    if (i.pencapaian !== null) terisi += i.bobot;
  }
  return {
    total,
    predikat: terisi > 0 ? predikatDariSkor(total) : null,
    cakupan: bobot > 0 ? Math.round((terisi / bobot) * 100) : 0,
  };
}

/**
 * Persen dari file GRD (pecahan, 0,98) ke bentuk aplikasi (98).
 *
 * `0.07 * 100` di JavaScript menghasilkan 7,000000000000001; tanpa
 * pembulatan ini pencapaian yang tepat di batas kolom bisa jatuh ke
 * kolom yang salah. Delapan desimal jauh melampaui ketelitian file.
 */
export function pecahanKePersen(pecahan: number): number {
  return Number((pecahan * 100).toFixed(8));
}

/** Pencapaian atau ambang menurut satuannya: "92,5%" atau "103,25 video/hari". */
export function tampilAngkaKpi(nilai: number, satuan: string) {
  return satuan === "%" ? persen(nilai, 2) : `${angka(nilai)} ${satuan}`.trim();
}

/**
 * Baris yang sudah dinilai. GRD: begitu ada satu pencapaian, karena yang
 * kosong dihitung 0. Jabatan: hanya yang cakupannya penuh.
 */
export function sudahDinilai(b: BarisScorecard): boolean {
  return b.metode === "grd" ? b.predikat !== null : b.cakupan >= 100;
}

/**
 * Ringkasan sekumpulan baris scorecard.
 *
 * Rata-rata sengaja hanya menghitung orang yang sudah dinilai: pada rumus
 * jabatan, skor dari cakupan parsial bertumpu pada sebagian bobot saja;
 * pada GRD, orang yang belum diisi sama sekali belum punya nilai. Dihitung
 * dari baris yang benar-benar terlihat pemakai, bukan query terpisah,
 * supaya ringkasan dan daftarnya tidak pernah bercerita berbeda.
 */
export function ringkasScorecard(daftar: BarisScorecard[]): RingkasScorecard {
  const penuh = daftar.filter(sudahDinilai);
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
