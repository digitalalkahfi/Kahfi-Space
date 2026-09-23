import { statusTerkirim } from "@/lib/batas-minimum";
import type { LaporanHarian } from "@/lib/types";

/** Bagian baris laporan yang dipakai rekap ini — sisanya tidak perlu. */
export type BarisRekap = Pick<
  LaporanHarian,
  "akunId" | "label" | "pelaporNama" | "jumlahUpload" | "minimumUpload"
>;

/** Satu baris rekap kepatuhan batas minimum. */
export type RekapMinimum = {
  kunci: string;
  label: string;
  /**
   * Batas minimum yang berlaku; null bila baris ini menggabungkan lebih
   * dari satu batas — orang yang memegang akun level 0 dan level 5
   * tidak punya satu angka minimum.
   */
  minimum: number | null;
  /** Laporan yang benar-benar bisa dinilai pada rentang ini. */
  laporan: number;
  terpenuhi: number;
  /** Persentase 0–100 dari laporan yang dinilai. */
  rasio: number;
  /** Kekurangan terbesar dalam satu hari; 0 bila tidak pernah kurang. */
  kurangTerdalam: number;
};

/**
 * Inti kedua rekap: kelompokkan, hitung, urutkan dari yang bermasalah.
 *
 * Yang dihitung hanya HARI YANG DILAPORKAN — bukan seluruh hari kerja.
 * Hari kerja tanpa laporan dinilai di mesin kepatuhan
 * (`kepatuhan_minimum_akun`), yang tahu absensi; halaman riwayat tidak.
 * Karena itu penyebutnya disebut apa adanya di layar — "2 dari 3
 * laporan", bukan persentase kepatuhan yang terdengar menghitung
 * seluruh hari kerja.
 *
 * Laporan tanpa kolom unggahan (MCN & TAP) dan akun tanpa level tidak
 * ikut sama sekali — tidak ada standar yang bisa dilanggar.
 */
function kelompokkan(
  riwayat: readonly BarisRekap[],
  kunciDari: (r: BarisRekap) => string,
  labelDari: (r: BarisRekap) => string,
): RekapMinimum[] {
  const per = new Map<string, RekapMinimum & { batas: Set<number> }>();

  for (const r of riwayat) {
    const status = statusTerkirim(r.jumlahUpload, r.minimumUpload);
    if (status === null || r.minimumUpload === null) continue;

    const kunci = kunciDari(r);
    const baris = per.get(kunci) ?? {
      kunci,
      label: labelDari(r),
      minimum: r.minimumUpload,
      laporan: 0,
      terpenuhi: 0,
      rasio: 0,
      kurangTerdalam: 0,
      batas: new Set<number>(),
    };

    baris.laporan += 1;
    if (status === "terpenuhi") baris.terpenuhi += 1;
    baris.kurangTerdalam = Math.max(
      baris.kurangTerdalam,
      r.minimumUpload - (r.jumlahUpload ?? 0),
    );
    baris.batas.add(r.minimumUpload);
    per.set(kunci, baris);
  }

  return [...per.values()]
    .map(({ batas, ...b }) => ({
      ...b,
      // Satu batas → tampilkan angkanya. Lebih dari satu (level naik di
      // tengah rentang, atau satu orang memegang beberapa level) →
      // tidak ada satu angka yang jujur untuk disebut.
      minimum: batas.size === 1 ? [...batas][0] : null,
      rasio: (b.terpenuhi / b.laporan) * 100,
    }))
    .sort((a, b) => a.rasio - b.rasio || a.label.localeCompare(b.label));
}

/**
 * Rekap per AKUN — yang dilihat saat menimbang akun mana yang perlu
 * ditindaklanjuti. Urut dari yang paling bermasalah.
 */
export function rekapMinimumPerAkun(
  riwayat: readonly BarisRekap[],
): RekapMinimum[] {
  return kelompokkan(
    riwayat,
    (r) => r.akunId ?? r.label,
    (r) => r.label,
  );
}

/**
 * Rekap per ORANG — satu orang bisa memegang beberapa akun, dan yang
 * ditegur Leader adalah orangnya, bukan akunnya.
 */
export function rekapMinimumPerOrang(
  riwayat: readonly BarisRekap[],
): RekapMinimum[] {
  return kelompokkan(
    riwayat,
    (r) => r.pelaporNama,
    (r) => r.pelaporNama,
  );
}

/** Satu kalimat ringkas untuk seluruh rekap; null bila tidak ada apa-apa. */
export function ringkasanRekapMinimum(rekap: readonly RekapMinimum[]) {
  if (rekap.length === 0) return null;
  const laporan = rekap.reduce((a, b) => a + b.laporan, 0);
  const terpenuhi = rekap.reduce((a, b) => a + b.terpenuhi, 0);
  return {
    baris: rekap.length,
    laporan,
    terpenuhi,
    kurang: laporan - terpenuhi,
    rasio: (terpenuhi / laporan) * 100,
  };
}
