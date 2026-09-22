/**
 * Sampel produk — tipe & aturan murni, dipakai server maupun browser.
 */
import type { KodeUnit } from "@/lib/types";

export type StatusSampel =
  "tersedia" | "dipegang" | "dikirim" | "diterima" | "dikembalikan" | "hilang";

export type Sampel = {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  unitKode: KodeUnit | null;
  unitNama: string;
  nilai: number;
  status: StatusSampel;
  pemegangId: string | null;
  pemegangNama: string | null;
  /** Akun affiliator yang memakai sampel ini, bila sudah ditentukan. */
  akunId: string | null;
  akunUsername: string | null;
  kreator: string;
  /** Brand atau seller pemilik produk; kosong bila belum diisi. */
  brand: string;
  /**
   * Tautan produk di TikTok Shop atau Shopee.
   *
   * Disimpan terpisah dari kode QR supaya bisa diganti tanpa mencetak
   * ulang stiker — barangnya tetap sama, hanya etalasenya yang pindah.
   */
  linkProduk: string | null;
  catatan: string;
  diperbaruiPada: string;
};

/** Marketplace yang dikenali dari tautan produknya. */
export type Etalase = "TikTok Shop" | "Shopee" | "Lainnya";

/**
 * Tautan produk yang aman dibuka.
 *
 * Hanya http(s) yang diterima: `javascript:` dan `data:` pada atribut
 * href adalah jalan masuk skrip asing lewat kolom yang diisi pengguna.
 */
export function tautanProdukSah(tautan: string | null | undefined): boolean {
  if (!tautan) return false;
  try {
    const url = new URL(tautan.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Nama etalase untuk label tombol; dibaca dari nama hostnya. */
export function etalaseProduk(tautan: string | null | undefined): Etalase {
  if (!tautanProdukSah(tautan)) return "Lainnya";
  const host = new URL(tautan!.trim()).hostname.toLowerCase();
  if (host.includes("tiktok")) return "TikTok Shop";
  if (host.includes("shopee")) return "Shopee";
  return "Lainnya";
}

export type KejadianSampel = {
  id: string;
  dari: StatusSampel | null;
  ke: StatusSampel;
  olehNama: string | null;
  pemegangNama: string | null;
  kreator: string;
  catatan: string;
  pada: string;
};

export const LABEL_STATUS_SAMPEL: Record<StatusSampel, string> = {
  tersedia: "Tersedia",
  dipegang: "Dipegang staf",
  dikirim: "Dikirim",
  diterima: "Di kreator",
  dikembalikan: "Dikembalikan",
  hilang: "Hilang",
};

export const GAYA_STATUS_SAMPEL: Record<
  StatusSampel,
  { kelas: string; titik: string }
> = {
  tersedia: { kelas: "bg-ok-fill text-ok-text", titik: "bg-ok" },
  dipegang: { kelas: "bg-info-fill text-info-text", titik: "bg-secondary" },
  dikirim: {
    kelas: "bg-accentmuted-fill text-accentmuted-text",
    titik: "bg-unit-tap",
  },
  diterima: { kelas: "bg-warn-fill text-warn-text", titik: "bg-warn" },
  dikembalikan: {
    kelas: "bg-muted text-muted-foreground",
    titik: "bg-muted-foreground/50",
  },
  hilang: { kelas: "bg-danger-fill text-danger-text", titik: "bg-danger" },
};

/**
 * Perpindahan yang masuk akal — padanan `perpindahan_sampel_sah` di
 * database. Dipakai UI untuk hanya menawarkan langkah yang mungkin,
 * supaya orang tidak menemui penolakan setelah menekan tombol.
 */
export const LANJUTAN: Record<StatusSampel, StatusSampel[]> = {
  tersedia: ["dipegang", "hilang"],
  dipegang: ["dikirim", "tersedia", "hilang"],
  dikirim: ["diterima", "hilang"],
  diterima: ["dikembalikan", "hilang"],
  // Barang kembali → diperiksa → masuk stok lagi.
  dikembalikan: ["tersedia", "dipegang", "hilang"],
  // Sampel hilang bisa ditemukan lagi; itu kabar baik, bukan kejanggalan.
  hilang: ["tersedia"],
};

export function perpindahanSah(dari: StatusSampel, ke: StatusSampel) {
  return LANJUTAN[dari].includes(ke);
}

/** Status yang berarti sampelnya sedang di luar gudang. */
export const DI_LUAR: StatusSampel[] = ["dipegang", "dikirim", "diterima"];

/** Selisih hari penuh antara dua waktu ISO; tidak pernah negatif. */
export function selisihHari(dari: string, sampai: string): number {
  const a = new Date(dari).getTime();
  const b = new Date(sampai).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}

export type PerjalananSampel = {
  /** Berapa kali barangnya benar-benar berpindah keadaan. */
  perpindahan: number;
  /** Sejak kapan ia berada di keadaan sekarang. */
  sejak: string | null;
  /** Lama di keadaan sekarang, dalam hari penuh. */
  lamaHari: number;
  /** Total hari barang berada di luar gudang sepanjang riwayatnya. */
  hariDiLuar: number;
  /** Sudah pernah sampai ke tangan kreator. */
  pernahKeKreator: boolean;
};

/**
 * Ringkasan perjalanan satu sampel.
 *
 * Riwayat mentah menjawab "apa yang terjadi"; ringkasan ini menjawab
 * pertanyaan yang sebenarnya diajukan orang saat menagih barang —
 * "sudah berapa lama di sana" dan "berapa lama ia di luar".
 *
 * Daftar kejadian diharapkan terurut terbaru dulu, sama seperti yang
 * dikembalikan `riwayatSampel`.
 */
export function ringkasPerjalanan(
  kejadian: KejadianSampel[],
  acuan: string,
): PerjalananSampel {
  if (kejadian.length === 0) {
    return {
      perpindahan: 0,
      sejak: null,
      lamaHari: 0,
      hariDiLuar: 0,
      pernahKeKreator: false,
    };
  }

  const terbaru = kejadian[0];
  // Dari terlama ke terbaru; rentang "di luar" dihitung maju.
  const urut = [...kejadian].sort((a, b) => a.pada.localeCompare(b.pada));

  let hariDiLuar = 0;
  for (const [i, k] of urut.entries()) {
    if (!DI_LUAR.includes(k.ke)) continue;
    const berikut = urut[i + 1]?.pada ?? acuan;
    hariDiLuar += selisihHari(k.pada, berikut);
  }

  return {
    perpindahan: kejadian.length,
    sejak: terbaru.pada,
    lamaHari: selisihHari(terbaru.pada, acuan),
    hariDiLuar,
    pernahKeKreator: kejadian.some((k) => k.ke === "diterima"),
  };
}

export type RingkasSampel = {
  total: number;
  diLuar: number;
  hilang: number;
  nilaiDiLuar: number;
  nilaiHilang: number;
};

/**
 * Ringkasan yang menjawab pertanyaan sebenarnya: berapa nilai barang
 * yang sedang tidak di gudang, dan berapa yang sudah tidak bisa
 * dipertanggungjawabkan.
 */
export function ringkasSampel(daftar: Sampel[]): RingkasSampel {
  const diLuar = daftar.filter((s) => DI_LUAR.includes(s.status));
  const hilang = daftar.filter((s) => s.status === "hilang");

  return {
    total: daftar.length,
    diLuar: diLuar.length,
    hilang: hilang.length,
    nilaiDiLuar: diLuar.reduce((a, s) => a + s.nilai, 0),
    nilaiHilang: hilang.reduce((a, s) => a + s.nilai, 0),
  };
}

/**
 * Menormalkan isi QR menjadi kode sampel.
 *
 * Pembaca QR tidak pernah mengembalikan teks yang rapi: ada yang
 * menyisipkan baris baru, ada yang mengembalikan spasi tak-putus, dan
 * stiker cetakan lama memuat URL lengkap alih-alih kodenya saja. Semua
 * itu harus tetap mengarah ke sampel yang sama — kalau tidak, pemindaian
 * yang sebetulnya benar tercatat sebagai "kode tidak dikenali" dan
 * orangnya menyalahkan barangnya.
 */
export function normalkanKode(isi: string): string {
  let teks = isi.replace(/[\u00a0\u2007\u202f]/g, " ").trim();

  // Stiker lama memuat tautan; yang berarti hanya ruas terakhirnya.
  if (/^https?:\/\//i.test(teks)) {
    try {
      const url = new URL(teks);
      const ruas = url.pathname.split("/").filter(Boolean);
      teks = decodeURIComponent(ruas.at(-1) ?? "");
    } catch {
      return "";
    }
  }

  // Sebagian pembaca menambahkan awalan jenis isi.
  teks = teks.replace(/^(kode|sampel|sample)\s*[:=]\s*/i, "");

  // Baris kedua dan seterusnya adalah keterangan cetak, bukan kodenya.
  teks = teks.split(/[\r\n]/)[0].trim();

  return POLA_KODE_SAMPEL.test(teks) ? teks.toUpperCase() : "";
}

/** Bentuk kode yang sah: 3–30 huruf, angka, atau tanda hubung. */
export const POLA_KODE_SAMPEL = /^[A-Z0-9][A-Z0-9-]{2,29}$/i;
