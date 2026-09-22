import type { KategoriNotifikasi } from "@/lib/notifikasi";

/**
 * Riwayat pengiriman WhatsApp.
 *
 * Yang dicatat bukan "pesannya", melainkan USAHANYA: ke nomor mana,
 * berhasil atau tidak, dan kenapa gagal. Isi pesannya tetap tinggal di
 * notifikasinya — menyalinnya ke sini berarti pesan yang sama tersimpan
 * dua kali dan bisa berbeda.
 */

export type StatusKirim = "antre" | "terkirim" | "gagal";

export const LABEL_STATUS_KIRIM: Record<StatusKirim, string> = {
  antre: "Menunggu dikirim",
  terkirim: "Terkirim",
  gagal: "Gagal",
};

export const GAYA_STATUS_KIRIM: Record<StatusKirim, string> = {
  antre: "bg-muted text-muted-foreground",
  terkirim: "bg-ok-fill text-ok-text",
  gagal: "bg-warn-fill text-warn-text",
};

export type Pengiriman = {
  id: string;
  notifikasiId: string;
  kategori: KategoriNotifikasi;
  judul: string;
  tujuan: string;
  status: StatusKirim;
  percobaan: number;
  galat: string;
  dikirimPada: string | null;
  dibuatPada: string;
};

/** Batas percobaan sebelum sebuah pengiriman dianggap menyerah. */
export const MAKS_PERCOBAAN = 3;

/**
 * Masih layak dicoba lagi?
 *
 * Yang gagal karena nomornya salah tidak akan berhasil pada percobaan
 * keempat; yang gagal karena gateway sedang tumbang, bisa. Karena itu
 * batasnya pada jumlah percobaan, bukan pada jenis galatnya — jenis
 * galat dari gateway pihak ketiga tidak bisa dipercaya untuk
 * membedakan keduanya.
 */
export function bisaCobaLagi(p: Pengiriman): boolean {
  return p.status === "gagal" && p.percobaan < MAKS_PERCOBAAN;
}

export type RingkasKirim = {
  total: number;
  terkirim: number;
  gagal: number;
  antre: number;
  /** Persentase keberhasilan dari yang sudah selesai dicoba. */
  keberhasilan: number;
};

/**
 * Ringkasan riwayat.
 *
 * Keberhasilan dihitung dari yang SUDAH selesai dicoba, bukan dari
 * seluruhnya: antrean yang panjang akan membuat angkanya terlihat
 * buruk padahal belum ada yang gagal.
 */
export function ringkasKirim(daftar: Pengiriman[]): RingkasKirim {
  const terkirim = daftar.filter((p) => p.status === "terkirim").length;
  const gagal = daftar.filter((p) => p.status === "gagal").length;
  const antre = daftar.filter((p) => p.status === "antre").length;
  const selesai = terkirim + gagal;

  return {
    total: daftar.length,
    terkirim,
    gagal,
    antre,
    keberhasilan: selesai > 0 ? (terkirim / selesai) * 100 : 0,
  };
}

/**
 * Nomor disamarkan sebagian saat ditampilkan.
 *
 * Halaman ini bisa terbuka di layar yang dilihat orang lain — di ruang
 * rapat, di layar yang dibagikan. Empat angka terakhir cukup untuk
 * mengenali nomor sendiri, dan tidak cukup untuk menghubunginya.
 */
export function samarkanNomor(nomor: string): string {
  if (nomor.length < 6) return nomor;
  const ekor = nomor.slice(-4);
  return `${nomor.slice(0, 4)}••••${ekor}`;
}

export type SaringanKirim = StatusKirim | "semua";

export function saringKirim(
  daftar: Pengiriman[],
  saringan: SaringanKirim,
): Pengiriman[] {
  return saringan === "semua"
    ? daftar
    : daftar.filter((p) => p.status === saringan);
}

export function bacaSaringanKirim(
  nilai: string | string[] | undefined,
): SaringanKirim {
  const satu = Array.isArray(nilai) ? nilai[0] : nilai;
  return satu === "antre" || satu === "terkirim" || satu === "gagal"
    ? satu
    : "semua";
}
