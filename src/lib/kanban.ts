/**
 * Aturan perpindahan kartu di papan Kanban (PRD Fase 4) — modul murni.
 *
 * Papan dan tombol memakai aturan yang sama persis. Kalau seretan punya
 * aturannya sendiri, akan ada perpindahan yang diterima papan tetapi
 * ditolak Server Action — dan pengguna melihat kartunya melompat balik
 * tanpa penjelasan.
 */
import type { StatusTugas } from "@/lib/types";

/** Status yang bisa dituju lewat `ubahStatusTugas`. */
export type StatusDapatDigeser = "todo" | "berjalan" | "menunggu_qc";

export type HasilPindah =
  | { boleh: true; ke: StatusDapatDigeser }
  /** Perlu keterangan hasil kerja dulu; bukan penolakan. */
  | { boleh: false; mintaHasilKerja: true }
  | { boleh: false; mintaHasilKerja: false; pesan: string };

/** Panjang minimal ringkasan hasil kerja; sama dengan Server Action. */
export const MIN_HASIL_KERJA = 5;

export function dapatDigeser(
  status: StatusTugas,
): status is StatusDapatDigeser {
  return status === "todo" || status === "berjalan" || status === "menunggu_qc";
}

/**
 * Boleh atau tidak sebuah kartu dipindahkan ke kolom tujuan.
 *
 * Kolom "Selesai" sengaja bukan tujuan yang bisa diseret: status itu
 * lahir dari keputusan QC (`periksaTugas`), bukan dari penerima tugas
 * yang menyatakan dirinya selesai.
 */
export function periksaPindah(input: {
  dari: StatusTugas;
  ke: StatusTugas;
  /** Hanya penerima tugas yang boleh menggeser statusnya. */
  sayaPenerima: boolean;
  hasilKerja: string;
}): HasilPindah {
  const { dari, ke, sayaPenerima, hasilKerja } = input;

  if (dari === ke) {
    return { boleh: false, mintaHasilKerja: false, pesan: "" };
  }

  if (!sayaPenerima) {
    return {
      boleh: false,
      mintaHasilKerja: false,
      pesan: "Hanya penerima tugas yang bisa memindahkan kartunya.",
    };
  }

  if (dari === "selesai") {
    return {
      boleh: false,
      mintaHasilKerja: false,
      pesan:
        "Tugas yang sudah lolos pemeriksaan dibuka lagi lewat QC, bukan dengan menggeser kartunya.",
    };
  }

  if (ke === "selesai") {
    return {
      boleh: false,
      mintaHasilKerja: false,
      pesan:
        "Selesai ditentukan pemeriksa, bukan penerima tugas. Ajukan pemeriksaan dulu.",
    };
  }

  if (ke === "menunggu_qc" && hasilKerja.trim().length < MIN_HASIL_KERJA) {
    // Pesannya nanti datang dari Server Action yang sama; di sini cukup
    // memintanya, sama seperti tombol "Ajukan pemeriksaan".
    return { boleh: false, mintaHasilKerja: true };
  }

  return { boleh: true, ke: ke as StatusDapatDigeser };
}

/**
 * Kolom ini akan menerima kartunya?
 *
 * Dipakai papan untuk mewarnai kolom saat kartu melayang:
 *   true  → kolomnya menerima
 *   false → kolomnya menolak
 *   null  → bukan pertanyaan yang berlaku (kolom asal kartu itu sendiri)
 *
 * "Minta hasil kerja" dihitung MENERIMA, bukan menolak: menjatuhkan
 * kartu di sana memang membuka kolom isian, dan menandainya merah akan
 * menghalangi orang melakukan hal yang benar.
 */
export function kolomMenerima(input: {
  dari: StatusTugas;
  ke: StatusTugas;
  sayaPenerima: boolean;
  hasilKerja: string;
}): boolean | null {
  if (input.dari === input.ke) return null;

  const hasil = periksaPindah(input);
  return hasil.boleh || hasil.mintaHasilKerja === true;
}
