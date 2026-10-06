/**
 * Aturan perpindahan kartu di papan Kanban (PRD Fase 4) — modul murni.
 *
 * Papan dan tombol memakai aturan yang sama persis. Kalau seretan punya
 * aturannya sendiri, akan ada perpindahan yang diterima papan tetapi
 * ditolak Server Action — dan pengguna melihat kartunya melompat balik
 * tanpa penjelasan.
 */
import type { StatusTugas, TipeTugas } from "@/lib/types";

/** Status yang bisa dituju lewat `ubahStatusTugas`. */
export type StatusDapatDigeser = "todo" | "berjalan" | "menunggu_qc";

export type HasilPindah =
  | { boleh: true; ke: StatusDapatDigeser }
  /** To-do pribadi dicentang selesai lewat seretan (`ubahCentangToDo`). */
  | { boleh: true; ke: "selesai" }
  /** Perlu keterangan hasil kerja dulu; bukan penolakan. */
  | { boleh: false; mintaHasilKerja: true }
  | { boleh: false; mintaHasilKerja: false; pesan: string };

/** Panjang minimal ringkasan hasil kerja; sama dengan Server Action. */
export const MIN_HASIL_KERJA = 5;

/** Pesan baku saat to-do pribadi diarahkan ke Review (D2). */
export const PESAN_TODO_TANPA_REVIEW =
  "To-do pribadi tidak perlu diperiksa. Centang jika sudah selesai.";

export function dapatDigeser(
  status: StatusTugas,
): status is StatusDapatDigeser {
  return status === "todo" || status === "berjalan" || status === "menunggu_qc";
}

/**
 * Boleh atau tidak sebuah kartu dipindahkan ke kolom tujuan.
 *
 * Untuk tiket, kolom "Selesai" sengaja bukan tujuan yang bisa diseret:
 * status itu lahir dari keputusan QC (`periksaTugas`), bukan dari
 * penerima tugas yang menyatakan dirinya selesai.
 *
 * To-do pribadi tidak punya pemeriksa (D2): alurnya To Do → Sedang
 * Dikerjakan → Selesai, dan Selesai boleh diseret — sama dengan
 * mencentang. Menariknya keluar dari Selesai sama dengan batal centang.
 */
export function periksaPindah(input: {
  dari: StatusTugas;
  ke: StatusTugas;
  tipe: TipeTugas;
  /** Hanya penerima tugas yang boleh menggeser statusnya. */
  sayaPenerima: boolean;
  hasilKerja: string;
}): HasilPindah {
  const { dari, ke, tipe, sayaPenerima, hasilKerja } = input;

  if (dari === ke) {
    return { boleh: false, mintaHasilKerja: false, pesan: "" };
  }

  if (!sayaPenerima) {
    return {
      boleh: false,
      mintaHasilKerja: false,
      pesan:
        tipe === "pribadi"
          ? "Hanya pemilik to-do yang bisa memindahkan kartunya."
          : "Hanya penerima tugas yang bisa memindahkan kartunya.",
    };
  }

  if (tipe === "pribadi") {
    if (ke === "menunggu_qc") {
      return {
        boleh: false,
        mintaHasilKerja: false,
        pesan: PESAN_TODO_TANPA_REVIEW,
      };
    }
    return ke === "selesai"
      ? { boleh: true, ke: "selesai" }
      : { boleh: true, ke };
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

  return { boleh: true, ke };
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
  tipe: TipeTugas;
  sayaPenerima: boolean;
  hasilKerja: string;
}): boolean | null {
  if (input.dari === input.ke) return null;

  const hasil = periksaPindah(input);
  return hasil.boleh || hasil.mintaHasilKerja === true;
}

// ---------------------------------------------------------------------
// Siapa boleh apa di kartu (0205)
//
// Cerminan aturan database (`kunci_isi_tiket`, `jaga_hapus_tugas`): tombolnya
// hanya kenyamanan, yang menolak adalah database. Dipakai kartu dan Server
// Action sekaligus supaya keduanya tidak berbeda pendapat.
// ---------------------------------------------------------------------

/** CEO dan Manager: bertanggung jawab atas seluruh tim, lintas unit. */
export function peranLintasUnit(peran: string): boolean {
  return peran === "CEO" || peran === "Manager";
}

/**
 * Tombol Edit. To-do: pemiliknya kapan pun. Tiket: pemberinya, atau CEO
 * dan Manager siapa pun pemberinya (0205) — selama belum selesai, karena
 * yang lolos QC sudah jadi nilai KPI penerimanya (0184). Penerima tidak
 * pernah menyunting isi tiketnya sendiri.
 */
export function bolehEditTugas(input: {
  tipe: TipeTugas;
  selesai: boolean;
  sayaPenerima: boolean;
  sayaPembuat: boolean;
  lintasUnit: boolean;
}): boolean {
  if (input.tipe === "pribadi") return input.sayaPenerima;
  if (input.selesai) return false;
  return input.sayaPembuat || input.lintasUnit;
}

/**
 * Tombol Hapus. To-do: pemiliknya, kapan pun. Tiket: pemberinya — juga yang
 * sudah selesai (0206; database menolaknya bila tiket itu ikut KPI bulan
 * yang sudah dikunci). Tiket dari rencana GRD: pemberinya yang CEO/Manager;
 * tonggaknya lalu tidak dibuatkan tiket lagi dan dikelola manual. CEO/Manager
 * yang bukan pemberi tidak mendapat tombol hapus.
 */
export function bolehHapusTugas(input: {
  tipe: TipeTugas;
  dariGrd: boolean;
  sayaPenerima: boolean;
  sayaPembuat: boolean;
  lintasUnit: boolean;
}): boolean {
  if (input.tipe === "pribadi") return input.sayaPenerima;
  if (!input.sayaPembuat) return false;
  return !input.dariGrd || input.lintasUnit;
}

/**
 * Tombol "Ubah deadline". To-do: pemiliknya. Tiket dari rencana GRD: CEO
 * dan Manager saja, supaya tonggak yang terlambat tidak "menjadi tepat"
 * karena tenggatnya digeser orang lain (0200). Tiket biasa: pemberinya,
 * atau CEO dan Manager (0205).
 */
export function bolehUbahTenggatTugas(input: {
  tipe: TipeTugas;
  selesai: boolean;
  dariGrd: boolean;
  sayaPenerima: boolean;
  sayaPembuat: boolean;
  lintasUnit: boolean;
}): boolean {
  if (input.selesai) return false;
  if (input.tipe === "pribadi") return input.sayaPenerima;
  if (input.dariGrd) return input.lintasUnit;
  return input.sayaPembuat || input.lintasUnit;
}
