/**
 * Catatan — catatan kerja pribadi yang bisa dibagikan; tipe & aturan murni.
 *
 * Bawaannya pribadi: yang menulis, dialah yang membaca. Dibagikan ke unit
 * atau ke seluruh perusahaan adalah pilihan penulisnya, dan tetap hanya
 * ia yang boleh mengubah atau menghapusnya (0167).
 */
import type { KodeUnit } from "@/lib/types";

export type KategoriCatatan = "dokumentasi" | "sop" | "rapat" | "lainnya";

export type VisibilitasCatatan = "pribadi" | "unit" | "perusahaan";

export const KATEGORI_CATATAN_SAH: KategoriCatatan[] = [
  "dokumentasi",
  "sop",
  "rapat",
  "lainnya",
];

export const VISIBILITAS_CATATAN_SAH: VisibilitasCatatan[] = [
  "pribadi",
  "unit",
  "perusahaan",
];

export type Catatan = {
  id: string;
  judul: string;
  isi: string;
  kategori: KategoriCatatan;
  visibilitas: VisibilitasCatatan;
  unitKode: KodeUnit | null;
  unitNama: string | null;
  disematkan: boolean;
  lampiran: string[];
  pemilikId: string;
  pemilikNama: string;
  dibuatPada: string;
  diperbaruiPada: string;
};

export const LABEL_KATEGORI_CATATAN: Record<KategoriCatatan, string> = {
  dokumentasi: "Dokumentasi",
  sop: "SOP",
  rapat: "Rapat",
  lainnya: "Lainnya",
};

export const GAYA_KATEGORI_CATATAN: Record<KategoriCatatan, string> = {
  dokumentasi: "bg-info-fill text-info-text",
  sop: "bg-accentmuted-fill text-accentmuted-text",
  rapat: "bg-warn-fill text-warn-text",
  lainnya: "bg-muted text-muted-foreground",
};

export const LABEL_VISIBILITAS: Record<VisibilitasCatatan, string> = {
  pribadi: "Pribadi",
  unit: "Unit",
  perusahaan: "Perusahaan",
};

export const ARTI_VISIBILITAS: Record<VisibilitasCatatan, string> = {
  pribadi: "Hanya kamu yang bisa membacanya.",
  unit: "Terbaca anggota unitmu dan manajemen.",
  perusahaan: "Terbaca semua orang yang masuk.",
};

export const GAYA_VISIBILITAS: Record<VisibilitasCatatan, string> = {
  pribadi: "bg-muted text-muted-foreground",
  unit: "bg-info-fill text-info-text",
  perusahaan: "bg-ok-fill text-ok-text",
};

/** Cuplikan isi untuk daftar: satu paragraf, tanpa baris baru. */
export function cuplikanCatatan(isi: string, batas = 160): string {
  const datar = isi.replace(/\s+/g, " ").trim();
  if (datar.length <= batas) return datar;
  const potong = datar.slice(0, batas);
  const spasi = potong.lastIndexOf(" ");
  return `${spasi > batas * 0.6 ? potong.slice(0, spasi) : potong}…`;
}

export type IzinCatatan = {
  /** Penulisnya sendiri. */
  milik: boolean;
  ubah: boolean;
  hapus: boolean;
};

/** Cerminan policy `notes_ubah`/`notes_hapus` (0167): hanya penulisnya. */
export function izinCatatan(
  pengguna: { id: string },
  catatan: Pick<Catatan, "pemilikId">,
): IzinCatatan {
  const milik = catatan.pemilikId === pengguna.id;
  return { milik, ubah: milik, hapus: milik };
}

export type SaringanCatatan = {
  cari: string;
  kategori: KategoriCatatan | "semua";
  /** milikku = yang kutulis; dibagikan = tulisan orang lain yang terbaca. */
  lingkup: "semua" | "milikku" | "dibagikan";
};

export const SARINGAN_CATATAN_KOSONG: SaringanCatatan = {
  cari: "",
  kategori: "semua",
  lingkup: "semua",
};

export function bacaSaringanCatatan(params: {
  cari?: string | string[];
  kategori?: string | string[];
  lingkup?: string | string[];
}): SaringanCatatan {
  const satu = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";
  const kategori = satu(params.kategori);
  const lingkup = satu(params.lingkup);
  return {
    cari: satu(params.cari).trim().slice(0, 60),
    kategori: KATEGORI_CATATAN_SAH.includes(kategori as KategoriCatatan)
      ? (kategori as KategoriCatatan)
      : "semua",
    lingkup:
      lingkup === "milikku" || lingkup === "dibagikan" ? lingkup : "semua",
  };
}

export function catatanTersaring(s: SaringanCatatan) {
  return s.cari !== "" || s.kategori !== "semua" || s.lingkup !== "semua";
}

export function saringCatatan(
  daftar: Catatan[],
  s: SaringanCatatan,
  penggunaId: string,
): Catatan[] {
  const kata = s.cari.toLowerCase();
  return daftar.filter((c) => {
    if (s.kategori !== "semua" && c.kategori !== s.kategori) return false;
    if (s.lingkup === "milikku" && c.pemilikId !== penggunaId) return false;
    if (s.lingkup === "dibagikan" && c.pemilikId === penggunaId) return false;
    if (kata === "") return true;
    return [c.judul, c.isi, c.pemilikNama, c.unitNama ?? ""].some((t) =>
      t.toLowerCase().includes(kata),
    );
  });
}

/**
 * Urutan tampil: catatan sendiri yang disematkan paling atas, lalu yang
 * terakhir diubah. Sematan orang lain tidak ikut naik — sematan adalah
 * urusan meja masing-masing.
 */
export function urutkanCatatan(
  daftar: Catatan[],
  penggunaId: string,
): Catatan[] {
  return [...daftar].sort((a, b) => {
    const sa = a.disematkan && a.pemilikId === penggunaId ? 0 : 1;
    const sb = b.disematkan && b.pemilikId === penggunaId ? 0 : 1;
    return sa - sb || b.diperbaruiPada.localeCompare(a.diperbaruiPada);
  });
}
