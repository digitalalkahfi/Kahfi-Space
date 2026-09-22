import type { KeputusanWrm, KodeUnit } from "@/lib/types";
import type { PredikatKpi } from "@/lib/kpi";

/** Warna identitas tiap unit pelaporan, dipakai di bar, titik, dan donut. */
export const gayaUnit: Record<
  KodeUnit,
  {
    bar: string;
    titik: string;
    teks: string;
    latar: string;
    garis: string;
  }
> = {
  affiliator: {
    bar: "bg-unit-affiliator",
    titik: "bg-unit-affiliator",
    teks: "text-unit-affiliator",
    latar: "bg-warn-fill",
    garis: "stroke-unit-affiliator",
  },
  mcn: {
    bar: "bg-unit-mcn",
    titik: "bg-unit-mcn",
    teks: "text-unit-mcn",
    latar: "bg-info-fill",
    garis: "stroke-unit-mcn",
  },
  tap: {
    bar: "bg-unit-tap",
    titik: "bg-unit-tap",
    teks: "text-unit-tap",
    latar: "bg-accentmuted-fill",
    garis: "stroke-unit-tap",
  },
};

/** Badge matriks WRM (DESIGN.md §Components 3). */
export const gayaKeputusanWrm: Record<
  KeputusanWrm,
  { kelas: string; titik: string; teks: string }
> = {
  LANJUT: {
    kelas: "bg-ok-fill text-ok-text",
    titik: "bg-ok",
    teks: "Lanjut Ritme",
  },
  SABAR: {
    kelas: "bg-warn-fill text-warn-text",
    titik: "bg-warn",
    teks: "Sabar",
  },
  ALARM: {
    kelas: "bg-danger-fill text-danger-text",
    titik: "bg-danger",
    teks: "Alarm",
  },
  "UBAH CARA": {
    kelas: "bg-danger-fill text-danger-text",
    titik: "bg-danger",
    teks: "Ubah Cara",
  },
};

/**
 * Warna predikat KPI. Urutannya sengaja sama dengan ambang
 * `predikat_dari_skor` di database: makin tinggi skor, makin tenang warnanya.
 */
export const gayaPredikatKpi: Record<
  PredikatKpi,
  { kelas: string; titik: string; teks: string }
> = {
  Istimewa: {
    kelas: "bg-ok-fill text-ok-text",
    titik: "bg-ok",
    teks: "text-ok-text",
  },
  Baik: {
    kelas: "bg-info-fill text-info-text",
    titik: "bg-secondary",
    teks: "text-info-text",
  },
  Cukup: {
    kelas: "bg-warn-fill text-warn-text",
    titik: "bg-warn",
    teks: "text-warn-text",
  },
  "Perlu Perbaikan": {
    kelas: "bg-danger-fill text-danger-text",
    titik: "bg-danger",
    teks: "text-danger-text",
  },
};

/** Ambang tiap predikat, untuk keterangan di layar. */
export const AMBANG_PREDIKAT: { predikat: PredikatKpi; label: string }[] = [
  { predikat: "Istimewa", label: "≥ 800" },
  { predikat: "Baik", label: "650–799" },
  { predikat: "Cukup", label: "500–649" },
  { predikat: "Perlu Perbaikan", label: "< 500" },
];
