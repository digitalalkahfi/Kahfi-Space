/**
 * Validasi isian anggota — dipakai "Tambah anggota" dan persetujuan
 * pendaftaran Google (BR-04: aturannya harus sama persis, jadi ditulis
 * sekali di sini). Murni, tanpa impor server maupun klien.
 */
import { peranSah } from "@/lib/peran";
import type { KodeUnit, Peran } from "@/lib/types";

export const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Peran yang memang bertugas di sebuah unit. */
export const PERAN_BERUNIT: Peran[] = ["Leader", "Co-Leader", "Staff"];

export type MasukanAnggota = {
  nama: string;
  email: string;
  role: Peran;
  jabatan: string;
  unitKode: KodeUnit | null;
  departemenId: string | null;
  programId: string | null;
  /**
   * Atasan langsung. Hanya dipakai saat menambah; perubahan atasan
   * anggota lama lewat DialogAtasan, yang memeriksa siklus dan
   * memperlihatkan akibatnya lebih dulu.
   */
  atasanId?: string | null;
};

export function periksa(input: MasukanAnggota): string | null {
  if (input.nama.trim().length < 3) return "Nama minimal 3 huruf.";
  if (!POLA_EMAIL.test(input.email.trim())) return "Format email tidak sah.";
  if (!peranSah(input.role)) return "Peran tidak dikenali.";
  if (input.jabatan.trim().length < 3) return "Jabatan minimal 3 huruf.";

  // Unit menentukan cakupan RLS; Leader tanpa unit tidak akan melihat
  // siapa pun. Staff boleh tanpa unit hanya sebagai tim manajemen —
  // langsung di bawah CEO atau Manager (dijaga aturan atasan dan 0164).
  if (
    PERAN_BERUNIT.includes(input.role) &&
    !input.unitKode &&
    input.role !== "Staff"
  ) {
    return `${input.role} wajib ditempatkan di salah satu unit.`;
  }
  if (!PERAN_BERUNIT.includes(input.role) && input.unitKode) {
    return `${input.role} bekerja lintas unit, jadi tidak ditempatkan di satu unit.`;
  }
  if (input.programId && !input.unitKode) {
    return "Program menempel pada satu unit, jadi unitnya harus dipilih dulu.";
  }
  return null;
}

/**
 * Atasan wajib bagi siapa pun kecuali CEO.
 *
 * Bukan formalitas: atasan itulah yang menyetujui izin dan menerima
 * laporannya. Anggota tanpa atasan tidak bisa mengajukan izin sama
 * sekali, dan itu baru ketahuan pada hari ia membutuhkannya.
 */
export function periksaAtasan(input: MasukanAnggota): string | null {
  if (input.role === "CEO") return null;
  return input.atasanId
    ? null
    : "Pilih atasan langsungnya — dialah yang menyetujui izin dan menerima laporannya.";
}
