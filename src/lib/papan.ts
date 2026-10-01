/**
 * Leaderboard GRD — bentuk data dan pengelompokan (Tahap 4, 0196).
 *
 * Angkanya tidak dihitung di sini: NILAI KPI datang dari `papan_kpi`,
 * yang membaca baris scorecard yang sama (`skor_kpi_bulan`), dan persen
 * akun dari `papan_akun_grd` dengan rumus `ukuran_persen` KPI. Modul ini
 * hanya mengelompokkan dan memberi label.
 */
import type { PredikatKpi } from "@/lib/kpi";
import type { Peran } from "@/lib/types";

export type KelompokPapan = "leader" | "co_leader" | "staf";

export const KELOMPOK_PAPAN: {
  kunci: KelompokPapan;
  judul: string;
  ringkas: string;
}[] = [
  {
    kunci: "leader",
    judul: "Leader",
    ringkas: "Leader dibandingkan dengan Leader.",
  },
  {
    kunci: "co_leader",
    judul: "Co-Leader",
    ringkas: "Co-Leader dibandingkan dengan Co-Leader.",
  },
  {
    kunci: "staf",
    judul: "Staf & Partner",
    ringkas: "Staf, Partner, dan staf pendukung dibandingkan sesamanya.",
  },
];

export type BarisPapanKpi = {
  userId: string;
  nama: string;
  inisial: string;
  jabatan: string;
  unit: string;
  kelompok: KelompokPapan;
  skor: number;
  /** null = "Belum diisi": belum satu pun pencapaian ada. */
  predikat: PredikatKpi | null;
  cakupan: number;
  terkunci: boolean;
  peringkat: number;
};

export type BarisPapanAkun = {
  accountId: string;
  username: string;
  pemegang: string | null;
  unit: string;
  /** Rupiah hanya untuk yang boleh melihat angka lintas unit. */
  realisasi: number | null;
  target: number | null;
  /** null = target akun belum ada. */
  persen: number | null;
  peringkat: number;
};

/** Padanan `kelompok_papan` (0196): CEO dan Manager tidak diperingkat. */
export function kelompokDariPeran(peran: Peran): KelompokPapan | null {
  switch (peran) {
    case "Leader":
      return "leader";
    case "Co-Leader":
      return "co_leader";
    case "Staff":
    case "Finance":
      return "staf";
    default:
      return null;
  }
}

/** Baris per level, urutannya dipertahankan seperti dari database. */
export function kelompokkanPapan(
  daftar: BarisPapanKpi[],
): Record<KelompokPapan, BarisPapanKpi[]> {
  const hasil: Record<KelompokPapan, BarisPapanKpi[]> = {
    leader: [],
    co_leader: [],
    staf: [],
  };
  for (const b of daftar) hasil[b.kelompok].push(b);
  return hasil;
}

/** Peringkat bersama untuk nilai sama, seperti `rank()`: 1, 1, 3. */
export function beriPeringkat<T>(daftar: T[], nilai: (x: T) => number | null) {
  const urut = [...daftar].sort(
    (a, b) => (nilai(b) ?? -Infinity) - (nilai(a) ?? -Infinity),
  );
  let sebelumnya: number | null | undefined;
  let peringkat = 0;
  return urut.map((x, i) => {
    const n = nilai(x);
    if (n !== sebelumnya) peringkat = i + 1;
    sebelumnya = n;
    return { ...x, peringkat };
  });
}
