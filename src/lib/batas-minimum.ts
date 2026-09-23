/**
 * Batas minimum unggahan per level akun (PRD Fase 1–3) — modul murni.
 *
 * Tiap akun affiliator punya level 0–8, dan tiap level menuntut sejumlah
 * unggahan minimum per hari kerja. Angkanya bukan target: target boleh
 * meleset dan tetap dinilai proporsional, sedangkan batas minimum adalah
 * lantai — di bawahnya dianggap tidak memenuhi standar level itu.
 *
 * Tabelnya ditulis di sini lebih dulu, lalu dicerminkan tabel referensi
 * di basis data pada Fase 3. Dua tempat, satu deret angka: kalau suatu
 * saat berbeda, tes yang membandingkannya yang akan gagal lebih dulu.
 */

import type { SasaranLaporan } from "@/lib/types";

export const LEVEL_MIN = 0;
export const LEVEL_MAKS = 8;

/**
 * Batas minimum unggahan untuk level 0 sampai 8, berurutan.
 *
 * Level 3 dan 4 sengaja sama (10), begitu pula level 7 dan 8 (20):
 * kenaikan level di sana menambah tanggung jawab lain, bukan menambah
 * jumlah unggahan.
 */
export const BATAS_MINIMUM_LEVEL = [3, 5, 7, 10, 10, 12, 15, 20, 20] as const;

export type LevelAkun = number;

/** Level yang sah adalah bilangan bulat 0–8. */
export function levelSah(level: unknown): level is LevelAkun {
  return (
    typeof level === "number" &&
    Number.isInteger(level) &&
    level >= LEVEL_MIN &&
    level <= LEVEL_MAKS
  );
}

/**
 * Batas minimum unggahan sebuah level; null bila levelnya belum
 * ditetapkan atau di luar rentang yang dikenal.
 *
 * Mengembalikan null, bukan nol: "belum punya level" dan "minimumnya
 * nol" adalah dua hal berbeda, dan yang kedua tidak pernah terjadi.
 */
export function batasMinimum(level: unknown): number | null {
  return levelSah(level) ? BATAS_MINIMUM_LEVEL[level] : null;
}

/** Label pendek untuk badge, mis. "batas minimum level 3: 10 video". */
export function labelBatasMinimum(level: unknown): string | null {
  const batas = batasMinimum(level);
  return batas === null ? null : `batas minimum level ${level}: ${batas} video`;
}

/**
 * Sebuah batas hanya berarti bila ia bilangan bulat positif.
 *
 * Tabel acuannya memang menjaga `> 0` (migrasi 0136), tapi angka batas
 * juga lahir dari penjumlahan beberapa akun dan dari data lama yang
 * belum tentu ikut aturan itu. Batas nol bukan standar yang longgar —
 * ia berarti TIDAK ADA standar, dan menilai setiap hari sebagai
 * "terpenuhi" terhadapnya akan menaikkan angka kepatuhan seluruh
 * perusahaan tanpa satu pun unggahan bertambah.
 */
function batasBerlaku(minimum: number | null): minimum is number {
  return minimum !== null && Number.isFinite(minimum) && minimum > 0;
}

/** Keadaan sebuah angka unggahan terhadap batas minimum levelnya. */
export type StatusMinimum = "terpenuhi" | "kurang" | "belum-diisi";

export const GAYA_MINIMUM: Record<
  Exclude<StatusMinimum, "belum-diisi">,
  { pil: string; teks: string }
> = {
  terpenuhi: { pil: "bg-ok-fill text-ok-text", teks: "text-ok-text" },
  kurang: { pil: "bg-warn-fill text-warn-text", teks: "text-warn-text" },
};

/**
 * Sudahkah angka unggahan hari ini memenuhi batas minimum levelnya.
 *
 * Nol dianggap "belum diisi", bukan "kurang": form yang baru dibuka
 * belum mengatakan apa-apa tentang hari itu, dan menandainya merah sejak
 * awal membuat peringatan yang sungguhan ikut diabaikan. Yang menilai
 * hari tanpa laporan sebagai tidak terpenuhi adalah mesin kepatuhan
 * (Fase 3), bukan form ini.
 */
export function statusMinimum(
  unggahan: number | null,
  minimum: number | null,
): StatusMinimum | null {
  if (!batasBerlaku(minimum)) return null;
  if (unggahan === null || unggahan <= 0) return "belum-diisi";
  return unggahan >= minimum ? "terpenuhi" : "kurang";
}

/**
 * Status sebuah angka unggahan yang SUDAH dikirim.
 *
 * Bedanya dengan `statusMinimum` cuma satu, tapi penting: di form, nol
 * berarti "belum diisi"; di riwayat dan rekap, nol berarti pelapornya
 * memang menyatakan nol unggahan hari itu — dan itu kurang. Mesin
 * kepatuhan menilainya dengan aturan yang sama.
 *
 * null berarti tidak dinilai: akun tanpa level, atau laporan yang memang
 * tidak memakai kolom unggahan (MCN & TAP).
 */
export function statusTerkirim(
  unggahan: number | null,
  minimum: number | null,
): Exclude<StatusMinimum, "belum-diisi"> | null {
  if (!batasBerlaku(minimum) || unggahan === null) return null;
  return unggahan >= minimum ? "terpenuhi" : "kurang";
}

/** Berapa unggahan lagi yang kurang; 0 bila sudah terpenuhi. */
export function kurangnya(
  unggahan: number | null,
  minimum: number | null,
): number {
  if (!batasBerlaku(minimum)) return 0;
  return Math.max(0, minimum - Math.max(0, unggahan ?? 0));
}

/**
 * Level dan batas minimum sebuah sasaran laporan.
 *
 * Batas minimum menempel pada AKUN, bukan pada unit: laporan tingkat
 * unit (MCN & TAP) tidak punya level sehingga tidak dinilai sama sekali.
 * Dipisah ke sini supaya form, riwayat, dan rekap membaca sasaran dengan
 * aturan yang sama — bukan tiga tafsiran yang kebetulan mirip.
 */
export function minimumSasaran(sasaran: SasaranLaporan | undefined): {
  level: number | null;
  minimum: number | null;
} {
  const level = sasaran?.jenis === "akun" ? sasaran.akun.level : null;
  return { level, minimum: batasMinimum(level) };
}

/** Satu hari dalam penilaian kepatuhan sebuah akun. */
export type HariKepatuhan = {
  tanggal: string;
  /**
   * Pemegang akun ini benar-benar masuk hari itu.
   *
   * Izin yang disetujui, sakit, dan hari libur bernilai false — hari
   * seperti itu tidak masuk pembagi sama sekali. Menghitungnya sebagai
   * hari kerja berarti menghukum orang karena izin yang sudah disetujui
   * atasannya sendiri.
   */
  hariKerja: boolean;
  /** Unggahan yang dilaporkan hari itu; null bila tidak ada laporan. */
  unggahan: number | null;
};

export type Kepatuhan = {
  /** Berapa hari yang benar-benar dinilai. */
  hariKerja: number;
  terpenuhi: number;
  /** Persentase 0–100; null bila tidak ada hari kerja sama sekali. */
  rasio: number | null;
  minimum: number | null;
};

export const KEPATUHAN_KOSONG: Kepatuhan = {
  hariKerja: 0,
  terpenuhi: 0,
  rasio: null,
  minimum: null,
};

/**
 * Kepatuhan sebuah akun terhadap batas minimum levelnya.
 *
 * Aturannya tiga kalimat:
 *   1. Hanya hari dengan absensi masuk yang dihitung.
 *   2. Hari kerja tanpa laporan dinilai TIDAK terpenuhi — diam bukan
 *      alasan; kalau tidak, orang yang tidak melapor sama sekali akan
 *      terlihat lebih patuh daripada yang melapor angka kecil.
 *   3. Tepat di batas sudah dianggap terpenuhi.
 *
 * Tanpa level, akunnya tidak punya standar apa pun sehingga tidak
 * dinilai — rasionya null, bukan nol.
 */
export function hitungKepatuhanMinimum(
  hari: readonly HariKepatuhan[],
  minimum: number | null,
): Kepatuhan {
  if (!batasBerlaku(minimum)) return { ...KEPATUHAN_KOSONG };

  const dinilai = hari.filter((h) => h.hariKerja);
  const terpenuhi = dinilai.filter((h) => (h.unggahan ?? 0) >= minimum).length;

  return {
    hariKerja: dinilai.length,
    terpenuhi,
    rasio: dinilai.length === 0 ? null : (terpenuhi / dinilai.length) * 100,
    minimum,
  };
}

/**
 * Kepatuhan seseorang: rata-rata kepatuhan seluruh akun yang ia pegang.
 *
 * Rata-rata per AKUN, bukan per hari yang digabung: orang yang memegang
 * satu akun ramai dan satu akun sepi tidak boleh terlihat patuh hanya
 * karena akun ramainya menyumbang lebih banyak hari.
 */
export function rataKepatuhan(daftar: readonly Kepatuhan[]): Kepatuhan {
  const dinilai = daftar.filter((k) => k.rasio !== null);
  if (dinilai.length === 0) return { ...KEPATUHAN_KOSONG };

  return {
    hariKerja: dinilai.reduce((a, k) => a + k.hariKerja, 0),
    terpenuhi: dinilai.reduce((a, k) => a + k.terpenuhi, 0),
    rasio: dinilai.reduce((a, k) => a + (k.rasio ?? 0), 0) / dinilai.length,
    minimum: null,
  };
}

/** Arah tren unggahan sebuah akun, dibaca ujung ke ujung. */
export type ArahTren = "naik" | "turun" | "datar";

/**
 * Tren tiga hari KERJA terakhir sebuah akun, lama → baru.
 *
 * Tinggal di modul murni ini, bukan di lapisan data, supaya komponen
 * layar bisa mengetiknya tanpa ikut menarik modul `server-only`.
 */
export type TrenTigaHari = {
  akunId: string;
  username: string;
  level: number | null;
  minimum: number | null;
  hariDinilai: number;
  jumlahTerpenuhi: number;
  hari: { tanggal: string; unggahan: number | null; terpenuhi: boolean }[];
  /** null bila belum ada dua hari untuk dibandingkan. */
  arah: ArahTren | null;
  /** Berapa hari terakhir berturut-turut yang di bawah minimum. */
  beruntunKurang: number;
};
