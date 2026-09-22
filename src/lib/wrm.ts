import type { CapaianUnit, KeputusanWrm } from "@/lib/types";
import { persen, rasioCapaian } from "@/lib/format";

/**
 * Keputusan ritme harian ala matriks WRM (PRD §3).
 *
 * Versi harian ini memakai satu sumbu: capaian GMV terhadap target prorata.
 * Matriks penuh (Hasil × KRI, dengan penandaan merah beruntun) dibentuk
 * mingguan di modul GRD dari tabel `weekly_reports`.
 */
export const AMBANG = { lanjut: 90, sabar: 75 } as const;

export function keputusanDariCapaian(rasio: number): KeputusanWrm {
  if (rasio >= AMBANG.lanjut) return "LANJUT";
  if (rasio >= AMBANG.sabar) return "SABAR";
  return "ALARM";
}

/**
 * Kalimat konteks yang menjelaskan keputusannya — bukan sekadar label,
 * tapi alasan yang bisa ditindaklanjuti.
 */
export function catatanRitme(
  unit: CapaianUnit[],
  gmv: number,
  target: number,
): string {
  if (unit.length === 0 || target <= 0) {
    return "Belum ada target aktif untuk dibandingkan hari ini.";
  }

  const rasio = rasioCapaian(gmv, target);
  const keputusan = keputusanDariCapaian(rasio);

  // Lini yang paling tertinggal; disebut namanya supaya dorongannya terarah.
  const tertinggal = [...unit]
    .filter((u) => rasioCapaian(u.gmv, u.target) < AMBANG.lanjut)
    .sort(
      (a, b) => rasioCapaian(a.gmv, a.target) - rasioCapaian(b.gmv, b.target),
    )
    .map((u) => u.namaPendek);

  // Catatan selalu sejalan dengan keputusannya — tidak boleh memuji
  // sambil menyebut "belum aman", atau sebaliknya.
  if (keputusan === "LANJUT") {
    return tertinggal.length === 0
      ? `Semua ${unit.length} lini bisnis di atas ${persen(AMBANG.lanjut, 0)} target prorata. Pertahankan ritme yang sudah jalan.`
      : `Capaian gabungan ${persen(rasio)} dari target prorata — ritme aman. Tinggal ${tertinggal[0]} yang perlu sedikit dorongan.`;
  }

  if (keputusan === "SABAR") {
    return tertinggal.length > 0
      ? `Capaian gabungan ${persen(rasio)} dari target prorata. ${tertinggal.slice(0, 2).join(" dan ")} tertinggal — maksimalkan sesi sore sebelum jam tayang berakhir.`
      : `Capaian gabungan ${persen(rasio)} dari target prorata. Belum aman, tetapi masih dalam jangkauan hari ini.`;
  }

  return `Capaian gabungan baru ${persen(rasio)} dari target prorata. ${
    tertinggal.length > 0
      ? `${tertinggal.slice(0, 2).join(" dan ")} paling tertinggal — perlu tindakan hari ini, bukan besok.`
      : "Perlu tindakan hari ini, bukan besok."
  }`;
}

/**
 * Arti tiap keputusan WRM — labelnya saja tidak cukup untuk ditindaklanjuti.
 * Dipakai bersama kartu status dan matriks kuadran supaya keduanya tidak
 * pernah menjelaskan hal yang berbeda.
 */
export const ARTI_WRM: Record<KeputusanWrm, string> = {
  LANJUT:
    "Hasil dan langkah kunci sama-sama sehat. Lanjutkan rencana pekan ini tanpa perubahan.",
  SABAR:
    "Hasil masih di atas target, tetapi langkah kuncinya melemah. Rapikan eksekusi sebelum hasilnya menyusul turun.",
  ALARM:
    "Langkah kunci jalan, tetapi hasilnya belum ikut. Asumsi rencananya perlu diperiksa, bukan orangnya.",
  "UBAH CARA":
    "Eksekusi dan hasil dua-duanya tertinggal. Rencana pekan ini perlu diganti, bukan sekadar ditambah usaha.",
};

/** Keputusan dari dua sumbu — padanan fungsi `keputusan_wrm` di database. */
export function keputusanWrm(hasilHijau: boolean, kriHijau: boolean): KeputusanWrm {
  if (hasilHijau) return kriHijau ? "LANJUT" : "SABAR";
  return kriHijau ? "ALARM" : "UBAH CARA";
}
