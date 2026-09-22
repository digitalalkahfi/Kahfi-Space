/**
 * Penyaringan daftar masalah — modul murni, dipakai server maupun browser.
 */
import {
  adaSolusi,
  type DampakMasalah,
  type Masalah,
  type StatusMasalah,
} from "@/lib/masalah";

export type SaringanMasalah = {
  cari: string;
  status: StatusMasalah | "terbuka" | "semua";
  dampak: DampakMasalah | "semua";
  unit: string;
  /** Hanya yang sudah diproses tapi solusinya masih kosong. */
  tanpaSolusi: boolean;
};

const STATUS_SAH: StatusMasalah[] = ["baru", "diproses", "selesai", "ditutup"];

const DAMPAK_SAH: DampakMasalah[] = ["rendah", "sedang", "tinggi"];

export const SARINGAN_MASALAH_KOSONG: SaringanMasalah = {
  cari: "",
  status: "semua",
  dampak: "semua",
  unit: "semua",
  tanpaSolusi: false,
};

/** Membaca saringan dari parameter URL, menolak nilai yang tidak dikenal. */
export function bacaSaringanMasalah(params: {
  cari?: string | string[];
  status?: string | string[];
  dampak?: string | string[];
  unit?: string | string[];
  solusi?: string | string[];
}): SaringanMasalah {
  const satu = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";

  const status = satu(params.status);
  const dampak = satu(params.dampak);

  return {
    cari: satu(params.cari).trim().slice(0, 60),
    status:
      status === "terbuka" || STATUS_SAH.includes(status as StatusMasalah)
        ? (status as SaringanMasalah["status"])
        : "semua",
    dampak: DAMPAK_SAH.includes(dampak as DampakMasalah)
      ? (dampak as DampakMasalah)
      : "semua",
    unit: satu(params.unit) || "semua",
    tanpaSolusi: satu(params.solusi) === "kosong",
  };
}

export function masalahTersaring(s: SaringanMasalah) {
  return (
    s.cari !== "" ||
    s.status !== "semua" ||
    s.dampak !== "semua" ||
    s.unit !== "semua" ||
    s.tanpaSolusi
  );
}

/**
 * Pencarian mencakup judul, konteks, dan solusinya.
 *
 * Solusi ikut dicari karena di situlah nilai arsip ini: orang yang kena
 * masalah serupa mencari kalimat penyelesaiannya, bukan judulnya.
 */
export function saringMasalah(
  daftar: Masalah[],
  s: SaringanMasalah,
): Masalah[] {
  const kata = s.cari.toLowerCase();

  return daftar.filter((m) => {
    if (s.status === "terbuka") {
      if (m.status === "selesai" || m.status === "ditutup") return false;
    } else if (s.status !== "semua" && m.status !== s.status) {
      return false;
    }

    if (s.dampak !== "semua" && m.dampak !== s.dampak) return false;
    if (s.unit !== "semua" && m.unitNama !== s.unit) return false;

    if (s.tanpaSolusi && (m.status !== "diproses" || adaSolusi(m))) {
      return false;
    }

    if (kata === "") return true;
    return [m.judul, m.konteks, m.unitNama, m.pelaporNama ?? "", m.solusi].some(
      (t) => t.toLowerCase().includes(kata),
    );
  });
}
