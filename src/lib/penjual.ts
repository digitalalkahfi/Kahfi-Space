/**
 * Penjual — mitra seller & brand yang digarap unit; tipe & aturan murni.
 *
 * Dulu daftar seller di K-Space lama hanya milik leader TAP. Di V2 ia
 * milik unit: siapa pun di unit itu melihatnya, leader dan PIC-nya yang
 * merawatnya. Status sengaja tiga saja — prospek, aktif, nonaktif —
 * karena itulah yang benar-benar dipakai orang di lapangan.
 */
import type { KodeUnit } from "@/lib/types";

export type StatusPenjual = "prospek" | "aktif" | "nonaktif";

export const STATUS_PENJUAL_SAH: StatusPenjual[] = [
  "prospek",
  "aktif",
  "nonaktif",
];

export type Penjual = {
  id: string;
  namaToko: string;
  namaKontak: string;
  telepon: string;
  kategori: string;
  status: StatusPenjual;
  /** Persen 0–100; null bila belum disepakati. */
  komisiPersen: number | null;
  catatan: string;
  unitKode: KodeUnit;
  unitNama: string;
  picId: string | null;
  picNama: string | null;
  dibuatOlehId: string | null;
  dibuatPada: string;
  diperbaruiPada: string;
};

export const LABEL_STATUS_PENJUAL: Record<StatusPenjual, string> = {
  prospek: "Prospek",
  aktif: "Aktif",
  nonaktif: "Nonaktif",
};

export const ARTI_STATUS_PENJUAL: Record<StatusPenjual, string> = {
  prospek: "Masih dijajaki, belum ada kesepakatan.",
  aktif: "Sudah bekerja sama.",
  nonaktif: "Berhenti atau tidak dilanjutkan.",
};

export const GAYA_STATUS_PENJUAL: Record<
  StatusPenjual,
  { kelas: string; titik: string }
> = {
  prospek: { kelas: "bg-warn-fill text-warn-text", titik: "bg-warn" },
  aktif: { kelas: "bg-ok-fill text-ok-text", titik: "bg-ok" },
  nonaktif: {
    kelas: "bg-muted text-muted-foreground",
    titik: "bg-muted-foreground/50",
  },
};

/**
 * Nomor telepon dibakukan ke bentuk internasional tanpa tanda, mis.
 * "0812-3456-7890" → "628123456789". Yang bukan nomor (sistem lama pernah
 * menyimpan nama aplikasi pesan) mengembalikan null.
 */
export function bakukanTelepon(nilai: string): string | null {
  const digit = nilai.replace(/[^\d+]/g, "");
  if (digit === "") return null;
  let bersih = digit.startsWith("+") ? digit.slice(1) : digit;
  if (bersih.startsWith("0")) bersih = `62${bersih.slice(1)}`;
  else if (bersih.startsWith("8")) bersih = `62${bersih}`;
  if (!/^62\d{8,13}$/.test(bersih)) return null;
  return bersih;
}

/** Tautan WhatsApp untuk nomor yang bisa dibakukan; null bila tidak. */
export function tautanWhatsApp(telepon: string): string | null {
  const baku = bakukanTelepon(telepon);
  return baku ? `https://wa.me/${baku}` : null;
}

/** Komisi dari teks bebas ("17", "10%", "12,5") menjadi persen; null bila kosong/tidak sah. */
export function komisiDariTeks(nilai: string): number | null {
  const teks = nilai.trim().replace("%", "").replace(",", ".");
  if (teks === "") return null;
  const angka = Number(teks);
  if (!Number.isFinite(angka) || angka < 0 || angka > 100) return null;
  return Math.round(angka * 100) / 100;
}

export type RingkasPenjual = {
  total: number;
  prospek: number;
  aktif: number;
  nonaktif: number;
};

export function ringkasPenjual(daftar: Penjual[]): RingkasPenjual {
  return {
    total: daftar.length,
    prospek: daftar.filter((p) => p.status === "prospek").length,
    aktif: daftar.filter((p) => p.status === "aktif").length,
    nonaktif: daftar.filter((p) => p.status === "nonaktif").length,
  };
}

/**
 * Sengaja hanya data: nilai ini menyeberang dari Server ke Client
 * Component, dan fungsi tidak bisa diserialkan.
 */
export type IzinPenjual = {
  /** CEO atau Manager. */
  pengelola: boolean;
  /** Boleh menambah mitra untuk unit tertentu (unit sendiri bagi leader). */
  tambah: boolean;
  /** Boleh mengubah data mitra ini. */
  ubah: boolean;
  /** Boleh menghapus mitra ini. */
  hapus: boolean;
};

/**
 * Cerminan policy `sellers_kelola`, `sellers_unit_kelola`, dan
 * `sellers_pic_ubah` (0166): database tetap penentunya, bagian ini hanya
 * menjaga layar tidak menawarkan yang pasti ditolak.
 */
export function izinPenjual(
  pengguna: { id: string; role: string; unitId: KodeUnit | null },
  penjual?: Pick<Penjual, "unitKode" | "picId">,
): IzinPenjual {
  const pengelola = pengguna.role === "CEO" || pengguna.role === "Manager";
  const memimpin =
    (pengguna.role === "Leader" || pengguna.role === "Co-Leader") &&
    pengguna.unitId !== null;
  const unitSama = penjual ? penjual.unitKode === pengguna.unitId : true;
  const pic = penjual ? penjual.picId === pengguna.id : false;

  return {
    pengelola,
    tambah: pengelola || memimpin,
    ubah: pengelola || (memimpin && unitSama) || pic,
    hapus: pengelola || (memimpin && unitSama),
  };
}

export type SaringanPenjual = {
  cari: string;
  status: StatusPenjual | "semua";
  unit: string;
  kategori: string;
};

export const SARINGAN_PENJUAL_KOSONG: SaringanPenjual = {
  cari: "",
  status: "semua",
  unit: "semua",
  kategori: "semua",
};

export function bacaSaringanPenjual(params: {
  cari?: string | string[];
  status?: string | string[];
  unit?: string | string[];
  kategori?: string | string[];
}): SaringanPenjual {
  const satu = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";
  const status = satu(params.status);
  return {
    cari: satu(params.cari).trim().slice(0, 60),
    status: STATUS_PENJUAL_SAH.includes(status as StatusPenjual)
      ? (status as StatusPenjual)
      : "semua",
    unit: satu(params.unit) || "semua",
    kategori: satu(params.kategori).trim().slice(0, 60) || "semua",
  };
}

export function penjualTersaring(s: SaringanPenjual) {
  return (
    s.cari !== "" ||
    s.status !== "semua" ||
    s.unit !== "semua" ||
    s.kategori !== "semua"
  );
}

export function saringPenjual(
  daftar: Penjual[],
  s: SaringanPenjual,
): Penjual[] {
  const kata = s.cari.toLowerCase();
  return daftar.filter((p) => {
    if (s.status !== "semua" && p.status !== s.status) return false;
    if (s.unit !== "semua" && p.unitNama !== s.unit) return false;
    if (s.kategori !== "semua" && p.kategori !== s.kategori) return false;
    if (kata === "") return true;
    return [
      p.namaToko,
      p.namaKontak,
      p.telepon,
      p.kategori,
      p.catatan,
      p.picNama ?? "",
    ].some((t) => t.toLowerCase().includes(kata));
  });
}

/** Urutan tampil: aktif dulu, lalu prospek, nonaktif terakhir; di dalamnya yang terbaru diubah lebih dulu. */
export function urutkanPenjual(daftar: Penjual[]): Penjual[] {
  const bobot: Record<StatusPenjual, number> = {
    aktif: 0,
    prospek: 1,
    nonaktif: 2,
  };
  return [...daftar].sort(
    (a, b) =>
      bobot[a.status] - bobot[b.status] ||
      b.diperbaruiPada.localeCompare(a.diperbaruiPada) ||
      a.namaToko.localeCompare(b.namaToko),
  );
}
