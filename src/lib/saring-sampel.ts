/**
 * Penyaringan riwayat perpindahan sampel — modul murni.
 */
import type { StatusSampel } from "@/lib/sampel";

export type BarisRiwayat = {
  id: string;
  sampelId: string;
  kode: string;
  namaSampel: string;
  unitNama: string;
  dari: StatusSampel | null;
  ke: StatusSampel;
  olehNama: string | null;
  pemegangNama: string | null;
  kreator: string;
  catatan: string;
  pada: string;
};

export type SaringanRiwayat = {
  cari: string;
  status: StatusSampel | "semua";
  unit: string;
  dari: string;
  sampai: string;
};

const STATUS_SAH: StatusSampel[] = [
  "tersedia",
  "dipegang",
  "dikirim",
  "diterima",
  "dikembalikan",
  "hilang",
];

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/** Membaca saringan dari parameter URL, menolak nilai yang tidak dikenal. */
export function bacaSaringanRiwayat(params: {
  cari?: string | string[];
  status?: string | string[];
  unit?: string | string[];
  dari?: string | string[];
  sampai?: string | string[];
}): SaringanRiwayat {
  const satu = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";

  const status = satu(params.status);
  const dari = satu(params.dari);
  const sampai = satu(params.sampai);

  return {
    cari: satu(params.cari).trim().slice(0, 60),
    status: STATUS_SAH.includes(status as StatusSampel)
      ? (status as StatusSampel)
      : "semua",
    unit: satu(params.unit) || "semua",
    dari: POLA_TANGGAL.test(dari) ? dari : "",
    sampai: POLA_TANGGAL.test(sampai) ? sampai : "",
  };
}

export function riwayatTersaring(s: SaringanRiwayat) {
  return (
    s.cari !== "" ||
    s.status !== "semua" ||
    s.unit !== "semua" ||
    s.dari !== "" ||
    s.sampai !== ""
  );
}

/**
 * Pencarian mencakup kode, nama barang, pencatat, pemegang, dan kreator.
 *
 * Orang mencari dengan potongan yang ia ingat — kadang kodenya, kadang
 * nama kreatornya. Membatasi pada kode saja membuat pencarian gagal
 * justru saat paling dibutuhkan.
 */
export function saringRiwayat(
  daftar: BarisRiwayat[],
  s: SaringanRiwayat,
): BarisRiwayat[] {
  const kata = s.cari.toLowerCase();

  return daftar.filter((b) => {
    if (s.status !== "semua" && b.ke !== s.status) return false;
    if (s.unit !== "semua" && b.unitNama !== s.unit) return false;

    const hari = b.pada.slice(0, 10);
    if (s.dari && hari < s.dari) return false;
    if (s.sampai && hari > s.sampai) return false;

    if (kata === "") return true;
    return [
      b.kode,
      b.namaSampel,
      b.olehNama ?? "",
      b.pemegangNama ?? "",
      b.kreator,
      b.catatan,
    ].some((t) => t.toLowerCase().includes(kata));
  });
}

// ---------------------------------------------------------------------
// Riwayat pemindaian
// ---------------------------------------------------------------------

export type BarisScan = {
  id: string;
  kode: string;
  dikenali: boolean;
  pada: string;
  olehNama: string | null;
  sampelNama: string | null;
  berlanjut: boolean;
};

export type SaringanScan = {
  cari: string;
  /** "asing" menyaring kode yang tidak dikenali — itulah yang ditindak. */
  jenis: "semua" | "dikenali" | "asing";
  dari: string;
  sampai: string;
};

/**
 * Saringan pemindaian dibaca dari parameter berawalan `scan_`.
 *
 * Diawali sendiri supaya tidak bertabrakan dengan saringan riwayat
 * perpindahan di halaman yang sama: keduanya hidup di URL yang sama, dan
 * menyaring satu tidak boleh diam-diam menyaring yang lain.
 */
export function bacaSaringanScan(params: {
  scan_cari?: string | string[];
  scan_jenis?: string | string[];
  scan_dari?: string | string[];
  scan_sampai?: string | string[];
}): SaringanScan {
  const satu = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";

  const jenis = satu(params.scan_jenis);
  const dari = satu(params.scan_dari);
  const sampai = satu(params.scan_sampai);

  return {
    cari: satu(params.scan_cari).trim().slice(0, 60),
    jenis: jenis === "dikenali" || jenis === "asing" ? jenis : "semua",
    dari: POLA_TANGGAL.test(dari) ? dari : "",
    sampai: POLA_TANGGAL.test(sampai) ? sampai : "",
  };
}

export function scanTersaring(s: SaringanScan) {
  return (
    s.cari !== "" || s.jenis !== "semua" || s.dari !== "" || s.sampai !== ""
  );
}

export function saringScan(daftar: BarisScan[], s: SaringanScan): BarisScan[] {
  const kata = s.cari.toLowerCase();

  return daftar.filter((b) => {
    if (s.jenis === "dikenali" && !b.dikenali) return false;
    if (s.jenis === "asing" && b.dikenali) return false;

    const hari = b.pada.slice(0, 10);
    if (s.dari && hari < s.dari) return false;
    if (s.sampai && hari > s.sampai) return false;

    if (kata === "") return true;
    return [b.kode, b.sampelNama ?? "", b.olehNama ?? ""].some((t) =>
      t.toLowerCase().includes(kata),
    );
  });
}
