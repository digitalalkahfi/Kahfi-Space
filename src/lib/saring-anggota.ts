/**
 * Penyaringan daftar anggota — modul murni, dipakai server maupun browser.
 */
import { peranSah } from "@/lib/peran";
import type { AnggotaTim, Peran } from "@/lib/types";

export type SaringanAnggota = {
  cari: string;
  peran: Peran | "semua";
  unit: string;
  /** PRD §6 menempatkan orang lewat empat sumbu; dua terakhir ikut di sini. */
  departemen: string;
  program: string;
  status: "semua" | "aktif" | "nonaktif";
};

export const SARINGAN_KOSONG: SaringanAnggota = {
  cari: "",
  peran: "semua",
  unit: "semua",
  departemen: "semua",
  program: "semua",
  status: "semua",
};

/** Membaca saringan dari parameter URL, menolak nilai yang tidak dikenal. */
export function bacaSaringan(params: {
  cari?: string | string[];
  peran?: string | string[];
  unit?: string | string[];
  departemen?: string | string[];
  program?: string | string[];
  status?: string | string[];
}): SaringanAnggota {
  const satu = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";

  const peran = satu(params.peran);
  const status = satu(params.status);

  return {
    cari: satu(params.cari).trim().slice(0, 60),
    peran: peranSah(peran) ? peran : "semua",
    unit: satu(params.unit) || "semua",
    departemen: satu(params.departemen) || "semua",
    program: satu(params.program) || "semua",
    status:
      status === "aktif" || status === "nonaktif"
        ? status
        : "semua",
  };
}

export function saringanAktif(s: SaringanAnggota) {
  return (
    s.cari !== "" ||
    s.peran !== "semua" ||
    s.unit !== "semua" ||
    s.departemen !== "semua" ||
    s.program !== "semua" ||
    s.status !== "semua"
  );
}

/**
 * Pencarian mencakup nama, jabatan, dan email — ketiganya cara orang
 * benar-benar mencari rekannya. Tanpa email, mencari "anisa@" gagal
 * padahal itu yang tertera di layar.
 */
export function saringAnggota(
  daftar: AnggotaTim[],
  s: SaringanAnggota,
): AnggotaTim[] {
  const kata = s.cari.toLowerCase();

  return daftar.filter((a) => {
    if (s.peran !== "semua" && a.role !== s.peran) return false;
    if (s.unit !== "semua" && a.unitNama !== s.unit) return false;
    if (s.departemen !== "semua" && a.departemen !== s.departemen) return false;
    if (s.program !== "semua" && a.program !== s.program) return false;
    if (s.status !== "semua" && a.status !== s.status) return false;
    if (kata === "") return true;

    return (
      a.nama.toLowerCase().includes(kata) ||
      a.jabatan.toLowerCase().includes(kata) ||
      a.email.toLowerCase().includes(kata)
    );
  });
}
