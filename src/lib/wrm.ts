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
    "Hasil dan kegiatan sama-sama hijau. Lanjutkan rencana pekan ini tanpa perubahan.",
  ALARM:
    "Hasil masih hijau, tetapi kegiatannya merah. Rapikan eksekusi sebelum hasilnya ikut turun.",
  SABAR:
    "Kegiatan sudah jalan, tetapi hasilnya belum ikut — biasanya faktor luar seperti tanggal tua atau menunggu Pay Day. Pertahankan kegiatannya.",
  "UBAH CARA":
    "Hasil merah bersama kegiatan merah, atau hasil merah dua pekan berturut-turut. Ubah caranya, bukan targetnya.",
};

/**
 * Keputusan WRM sesuai DECISION-021 file GRD — padanan `keputusan_wrm`
 * dan `lengkapi_laporan_mingguan` (0189). Hasil merah dua pekan
 * berturut-turut selalu UBAH CARA.
 */
export function keputusanWrm(
  hasilHijau: boolean,
  kriHijau: boolean,
  merahBeruntun = 0,
): KeputusanWrm {
  if (merahBeruntun >= 2) return "UBAH CARA";
  if (hasilHijau) return kriHijau ? "LANJUT" : "ALARM";
  return kriHijau ? "SABAR" : "UBAH CARA";
}
