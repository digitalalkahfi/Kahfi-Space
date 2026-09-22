/**
 * Kaizen — laporan masalah dan solusinya; tipe & aturan murni.
 *
 * Alurnya sengaja pendek: seseorang melapor, manajemen menerimanya
 * (diproses), lalu menulis solusinya dan menandainya selesai. Rantai
 * 5-Why yang dulu ada di sini dilepas pada migrasi 0121 — metodenya
 * benar di atas kertas, tapi yang terjadi di lapangan adalah masalah
 * yang mandek di "baru" karena formulirnya tidak pernah terisi.
 */
import type { KodeUnit } from "@/lib/types";

export type StatusMasalah = "baru" | "diproses" | "selesai" | "ditutup";

export type DampakMasalah = "rendah" | "sedang" | "tinggi";

export type Masalah = {
  id: string;
  judul: string;
  konteks: string;
  unitKode: KodeUnit | null;
  unitNama: string;
  pelaporNama: string | null;
  dampak: DampakMasalah;
  status: StatusMasalah;
  /** Jawaban manajemen; kosong selama belum ditulis. */
  solusi: string;
  ditutupAlasan: string;
  dibuatPada: string;
};

export const LABEL_STATUS_MASALAH: Record<StatusMasalah, string> = {
  baru: "Baru",
  diproses: "Diproses",
  selesai: "Selesai",
  ditutup: "Ditutup",
};

/** Kalimat pendek yang menjelaskan tiap status apa adanya. */
export const ARTI_STATUS_MASALAH: Record<StatusMasalah, string> = {
  baru: "Sudah dilaporkan, belum diterima manajemen.",
  diproses: "Diterima manajemen dan sedang dikerjakan.",
  selesai: "Solusinya sudah ditulis dan dijalankan.",
  ditutup: "Tidak dilanjutkan, dengan alasan yang tercatat.",
};

export const GAYA_STATUS_MASALAH: Record<
  StatusMasalah,
  { kelas: string; titik: string }
> = {
  baru: { kelas: "bg-warn-fill text-warn-text", titik: "bg-warn" },
  diproses: { kelas: "bg-info-fill text-info-text", titik: "bg-secondary" },
  selesai: { kelas: "bg-ok-fill text-ok-text", titik: "bg-ok" },
  ditutup: {
    kelas: "bg-muted text-muted-foreground",
    titik: "bg-muted-foreground/50",
  },
};

export const LABEL_DAMPAK: Record<DampakMasalah, string> = {
  rendah: "Dampak rendah",
  sedang: "Dampak sedang",
  tinggi: "Dampak tinggi",
};

export const GAYA_DAMPAK: Record<DampakMasalah, string> = {
  rendah: "bg-muted text-muted-foreground",
  sedang: "bg-warn-fill text-warn-text",
  tinggi: "bg-danger-fill text-danger-text",
};

/** Panjang minimum solusi; sama dengan syarat trigger 0121. */
export const MIN_SOLUSI = 10;

/** Sudah ada solusinya yang layak disebut solusi? */
export function adaSolusi(masalah: Pick<Masalah, "solusi">): boolean {
  return masalah.solusi.trim().length >= MIN_SOLUSI;
}

export type RingkasMasalah = {
  total: number;
  /** Dilaporkan tapi belum disentuh manajemen sama sekali. */
  belumDiterima: number;
  /** Sudah diterima, solusinya belum ditulis. */
  diproses: number;
  selesai: number;
};

/**
 * Yang perlu diperhatikan bukan jumlah masalahnya, melainkan yang
 * menggantung: laporan yang belum diterima siapa pun, dan yang sudah
 * diterima tapi belum ada jawabannya.
 */
export function ringkasMasalah(daftar: Masalah[]): RingkasMasalah {
  return {
    total: daftar.length,
    belumDiterima: daftar.filter((m) => m.status === "baru").length,
    diproses: daftar.filter((m) => m.status === "diproses").length,
    selesai: daftar.filter((m) => m.status === "selesai").length,
  };
}

/**
 * Sengaja hanya berisi data, tanpa satu pun fungsi: nilai ini menyeberang
 * dari Server ke Client Component, dan fungsi tidak bisa diserialkan.
 */
export type IzinMasalah = {
  /** Id pengguna yang izinnya dihitung. */
  penggunaId: string;
  /** CEO atau Manager. */
  pengelola: boolean;
  /** Boleh menulis dan menyunting solusinya. */
  isiSolusi: boolean;
  /** Boleh memindahkan status masalah. */
  ubahStatus: boolean;
  /** Alasan singkat bila solusinya tidak bisa disunting. */
  alasanTakBisaIsi: string | null;
};

/**
 * Apa yang boleh dilakukan seseorang pada sebuah laporan.
 *
 * Dikumpulkan di satu tempat dan diuji, bukan disebar sebagai
 * pengecekan peran di tiap komponen: aturan yang tersebar cepat
 * berbeda-beda antar-layar, dan perbedaan itulah yang berakhir menjadi
 * lubang wewenang.
 *
 * Cerminan policy `problems_kelola` dan trigger `jaga_lapor_masalah`
 * di database — database tetap penentunya, bagian ini hanya menjaga
 * layar tidak menawarkan yang pasti ditolak.
 */
export function izinMasalah(
  pengguna: { id: string; role: string },
  masalah: Pick<Masalah, "status">,
): IzinMasalah {
  const pengelola = pengguna.role === "CEO" || pengguna.role === "Manager";
  const ditutup = masalah.status === "ditutup";

  return {
    penggunaId: pengguna.id,
    pengelola,
    isiSolusi: pengelola && !ditutup,
    ubahStatus: pengelola,
    alasanTakBisaIsi: !pengelola
      ? "Solusi ditulis manajemen. Kamu tetap bisa mengikuti perkembangannya di sini."
      : ditutup
        ? "Laporan ini sudah ditutup. Buka kembali dulu bila ternyata perlu dikerjakan."
        : null,
  };
}
