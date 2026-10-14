/**
 * Aturan murni tabel "Detail per akun Affiliator"
 * (docs/KOMISI-DETAIL-AKUN-AFFILIATOR.md §4.4). Tanpa impor server.
 */
import type { Kepatuhan } from "@/lib/batas-minimum";

/** Bagian `AkunKelola` yang dipakai tabel ini. */
type AkunDasar = {
  id: string;
  username: string;
  status: "aktif" | "nonaktif";
  picNama: string | null;
  level: number | null;
  minimum: number | null;
  gmvPeriode: number;
  kepatuhan: Kepatuhan;
};

/** Satu laporan akun pada periode itu, cukup untuk dijumlahkan. */
type LaporanAkun = {
  accountId: string;
  upload: number | null;
  komisi: number | null;
};

export type BarisAkunAffiliator = {
  id: string;
  username: string;
  aktif: boolean;
  picNama: string | null;
  level: number | null;
  /** Batas minimum unggahan per hari kerja; null bila level belum ada. */
  minimum: number | null;
  totalUpload: number;
  /** Rata-rata upload per hari kerja; null bila belum ada hari kerja. */
  rataUpload: number | null;
  /** Kepatuhan minimum 0–100; null = belum dinilai (E7). */
  kepatuhan: number | null;
  hariKerja: number;
  hariLapor: number;
  gmv: number;
  komisi: number;
  /** Akun aktif tanpa satu laporan pun di periode ini (ditandai, §4.4). */
  tanpaLaporan: boolean;
};

/**
 * Gabungkan akun dengan laporannya.
 *
 * Akun aktif SELALU tampil, termasuk yang tanpa laporan — justru itu
 * yang paling perlu dilihat CEO. Akun nonaktif hanya tampil bila punya
 * GMV atau komisi di periode itu.
 *
 * `komisiPer` dipakai bila komisinya sudah dijumlahkan database per
 * akun (mode Supabase); tanpa itu komisi dijumlahkan dari laporannya.
 */
export function barisAkunAffiliator(
  akun: readonly AkunDasar[],
  laporan: readonly LaporanAkun[],
  komisiPer?: ReadonlyMap<string, number>,
): BarisAkunAffiliator[] {
  const per = new Map<
    string,
    { upload: number; hari: number; komisi: number }
  >();
  for (const l of laporan) {
    const ada = per.get(l.accountId) ?? { upload: 0, hari: 0, komisi: 0 };
    ada.upload += l.upload ?? 0;
    ada.hari += 1;
    ada.komisi += l.komisi ?? 0;
    per.set(l.accountId, ada);
  }

  return akun
    .map((a) => {
      const l = per.get(a.id) ?? { upload: 0, hari: 0, komisi: 0 };
      const komisi = komisiPer ? (komisiPer.get(a.id) ?? 0) : l.komisi;
      const hariKerja = a.kepatuhan.hariKerja;
      return {
        id: a.id,
        username: a.username,
        aktif: a.status === "aktif",
        picNama: a.picNama,
        level: a.level,
        minimum: a.minimum,
        totalUpload: l.upload,
        rataUpload:
          hariKerja > 0 ? Math.round((l.upload / hariKerja) * 10) / 10 : null,
        kepatuhan: a.kepatuhan.rasio,
        hariKerja,
        hariLapor: l.hari,
        gmv: a.gmvPeriode,
        komisi,
        tanpaLaporan: a.status === "aktif" && l.hari === 0,
      };
    })
    .filter((b) => b.aktif || b.gmv > 0 || b.komisi > 0);
}

/**
 * Laporan tingkat unit Affiliator (tanpa akun) sebagai satu baris.
 * Jarang ada, tetapi kartu Affiliator di dasbor ikut menghitungnya;
 * tanpa baris ini total tabel bisa berbeda dari kartu itu.
 */
export function barisLaporanUnit(
  laporan: readonly { gmv: number; upload: number | null }[],
  komisi: number,
): BarisAkunAffiliator {
  return {
    id: "laporan-unit",
    username: "Laporan tingkat unit",
    aktif: true,
    picNama: null,
    level: null,
    minimum: null,
    totalUpload: laporan.reduce((a, l) => a + (l.upload ?? 0), 0),
    rataUpload: null,
    kepatuhan: null,
    hariKerja: 0,
    hariLapor: laporan.length,
    gmv: laporan.reduce((a, l) => a + l.gmv, 0),
    komisi,
    tanpaLaporan: false,
  };
}

export type KolomUrut =
  | "username"
  | "picNama"
  | "level"
  | "totalUpload"
  | "rataUpload"
  | "kepatuhan"
  | "gmv"
  | "komisi"
  | "hariLapor";

/** Urutan bawaan: GMV terbesar (§4.4). */
export const URUT_BAWAAN: { kolom: KolomUrut; arah: "naik" | "turun" } = {
  kolom: "gmv",
  arah: "turun",
};

/**
 * Urutkan per kolom. Nilai kosong (level/kepatuhan belum ada) selalu di
 * bawah, ke arah mana pun — kosong bukan "paling kecil".
 */
export function urutkanAkun(
  baris: readonly BarisAkunAffiliator[],
  kolom: KolomUrut,
  arah: "naik" | "turun",
): BarisAkunAffiliator[] {
  const kali = arah === "naik" ? 1 : -1;
  return [...baris].sort((a, b) => {
    const x = a[kolom];
    const y = b[kolom];
    if (x === null && y === null) return a.username.localeCompare(b.username);
    if (x === null) return 1;
    if (y === null) return -1;
    const beda =
      typeof x === "string" && typeof y === "string"
        ? x.localeCompare(y)
        : Number(x) - Number(y);
    return beda !== 0 ? beda * kali : a.username.localeCompare(b.username);
  });
}

/** Baris Total di atas tabel. */
export function totalAkun(baris: readonly BarisAkunAffiliator[]) {
  return baris.reduce(
    (t, b) => ({
      upload: t.upload + b.totalUpload,
      gmv: t.gmv + b.gmv,
      komisi: t.komisi + b.komisi,
    }),
    { upload: 0, gmv: 0, komisi: 0 },
  );
}
