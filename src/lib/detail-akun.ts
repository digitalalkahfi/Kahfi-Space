/**
 * Aturan murni halaman Detail Akun (`/akun/[id]`,
 * docs/DETAIL-PER-AKUN-GRAFIK.md §5). Tanpa impor server maupun klien.
 *
 * Semua angka berasal dari data yang sudah dilaporkan (D2): GMV, komisi,
 * jumlah upload. Tidak ada input baru.
 */
import type { TitikGrafik } from "@/lib/grafik";
import type { RentangPeriode } from "@/lib/periode-finance";
import { selisihHari, tambahHari } from "@/lib/gmv";

/** Satu hari pada satu akun. */
export type HariAkun = {
  tanggal: string;
  /** Ada laporan akun ini pada hari itu. */
  lapor: boolean;
  gmv: number;
  upload: number | null;
  /** null bila tidak boleh dilihat atau tidak diisi. */
  komisi: number | null;
  /**
   * PIC akun ini benar-benar masuk kerja hari itu (absen dengan jam
   * masuk) — definisi yang sama dengan `kepatuhan_minimum_akun`. Izin,
   * sakit, dan libur bernilai false.
   */
  hariKerja: boolean;
};

export type StatusHari =
  "memenuhi" | "kurang" | "terlapor" | "tidak-lapor" | "libur";

export const LABEL_STATUS_HARI: Record<StatusHari, string> = {
  memenuhi: "Memenuhi",
  kurang: "Di bawah minimum",
  terlapor: "Terlapor",
  "tidak-lapor": "Tidak lapor",
  libur: "Libur/Izin",
};

/**
 * Status satu hari (§5.2 no. 6). Tepat di batas sudah memenuhi, sama
 * dengan aturan kepatuhan.
 *
 * Hanya hari kerja yang dinilai, persis `kepatuhan_minimum_akun`:
 * laporan pada hari PIC tidak absen masuk — atau pada akun tanpa
 * level — hanya "Terlapor". Dengan begitu jumlah "Memenuhi" di tabel
 * sama dengan kartu kepatuhan, dan "Di bawah minimum" + "Tidak lapor"
 * sama dengan sorotan hari kerja di bawah minimum.
 */
export function statusHari(h: HariAkun, minimum: number | null): StatusHari {
  if (!h.lapor) return h.hariKerja ? "tidak-lapor" : "libur";
  if (minimum === null || !h.hariKerja) return "terlapor";
  return (h.upload ?? 0) >= minimum ? "memenuhi" : "kurang";
}

/** Daftar tanggal ISO dari `dari` sampai `sampai`, inklusif. */
export function daftarTanggal(dari: string, sampai: string): string[] {
  const n = selisihHari(dari, sampai);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => tambahHari(dari, i));
}

/**
 * Susun hari demi hari dari laporan, komisi, dan hari kerja.
 * Tanggal di luar `laporan` berarti tidak ada laporan hari itu.
 */
export function susunHari(
  tanggal: readonly string[],
  laporan: ReadonlyMap<string, { gmv: number; upload: number | null }>,
  komisi: ReadonlyMap<string, number> | null,
  hariKerja: ReadonlySet<string>,
): HariAkun[] {
  return tanggal.map((t) => {
    const l = laporan.get(t);
    return {
      tanggal: t,
      lapor: Boolean(l),
      gmv: l?.gmv ?? 0,
      upload: l?.upload ?? null,
      komisi: l && komisi ? (komisi.get(t) ?? null) : null,
      hariKerja: hariKerja.has(t),
    };
  });
}

/** Hari dalam rentang [dari, sampai]. */
export function dalamRentang(
  hari: readonly HariAkun[],
  r: { dari: string; sampai: string },
): HariAkun[] {
  return hari.filter((h) => h.tanggal >= r.dari && h.tanggal <= r.sampai);
}

// ---------------------------------------------------------------------
// Ringkasan & kartu
// ---------------------------------------------------------------------

export type RingkasAkun = {
  gmv: number;
  upload: number;
  komisi: number;
  hariLapor: number;
  hariKerja: number;
};

export function ringkasAkun(hari: readonly HariAkun[]): RingkasAkun {
  return hari.reduce(
    (a, h) => ({
      gmv: a.gmv + (h.lapor ? h.gmv : 0),
      upload: a.upload + (h.upload ?? 0),
      komisi: a.komisi + (h.komisi ?? 0),
      hariLapor: a.hariLapor + (h.lapor ? 1 : 0),
      hariKerja: a.hariKerja + (h.hariKerja ? 1 : 0),
    }),
    { gmv: 0, upload: 0, komisi: 0, hariLapor: 0, hariKerja: 0 },
  );
}

export type SorotanAkun = {
  /** Hari dengan GMV tertinggi; null bila tidak ada laporan. */
  tertinggi: { tanggal: string; gmv: number } | null;
  /** Rata-rata GMV per hari lapor; null bila tidak ada laporan. */
  rataPerHariLapor: number | null;
  /**
   * Hari kerja yang tidak memenuhi minimum upload (termasuk yang tidak
   * dilaporkan — diam bukan alasan). null bila akun belum punya level.
   */
  hariDiBawahMinimum: number | null;
};

/** Sorotan singkat (§5.2 no. 5), dihitung tanpa AI. */
export function sorotanAkun(
  hari: readonly HariAkun[],
  minimum: number | null,
): SorotanAkun {
  const lapor = hari.filter((h) => h.lapor);
  const tertinggi = lapor.reduce<HariAkun | null>(
    (a, h) => (a === null || h.gmv > a.gmv ? h : a),
    null,
  );
  return {
    tertinggi: tertinggi
      ? { tanggal: tertinggi.tanggal, gmv: tertinggi.gmv }
      : null,
    rataPerHariLapor:
      lapor.length === 0
        ? null
        : lapor.reduce((a, h) => a + h.gmv, 0) / lapor.length,
    hariDiBawahMinimum:
      minimum === null
        ? null
        : hari.filter((h) => h.hariKerja && (h.upload ?? 0) < minimum).length,
  };
}

export type BarisHarian = HariAkun & { status: StatusHari };

/**
 * Baris tabel harian (§5.2 no. 6): terbaru di atas, dengan statusnya.
 * Batas minimumnya level akun saat ini — sama dengan penilaian
 * `kepatuhan_minimum_akun`, supaya tabel ini dan kartu kepatuhan tidak
 * pernah bertentangan.
 */
export function barisHarian(
  hari: readonly HariAkun[],
  minimum: number | null,
): BarisHarian[] {
  return [...hari]
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    .map((h) => ({ ...h, status: statusHari(h, minimum) }));
}

// ---------------------------------------------------------------------
// Grafik
// ---------------------------------------------------------------------

/** Panjang jendela grafik pada mode Harian (§5.2 no. 4, AC9). */
export const HARI_GRAFIK_HARIAN = 14;

/** Rentang di atas ini digambar per bulan, bukan per hari. */
export const BATAS_GRAFIK_HARIAN = 62;

export type Granularitas = "harian" | "bulanan";

/**
 * Rentang yang digambar grafik dan pembandingnya.
 *
 * Mode Harian menampilkan 14 hari terakhir sampai tanggal terpilih,
 * dibandingkan 14 hari sebelumnya. Mode lain memakai rentang periodenya
 * sendiri, dibandingkan rentang pembanding penuh (`penuh`) yang
 * disejajarkan per urutan titik.
 */
export function rentangGrafik(
  rentang: RentangPeriode,
  penuh: { dari: string; sampai: string },
): {
  sekarang: { dari: string; sampai: string };
  lalu: { dari: string; sampai: string };
  granularitas: Granularitas;
} {
  if (rentang.jenis === "harian") {
    const dari = tambahHari(rentang.sampai, -(HARI_GRAFIK_HARIAN - 1));
    return {
      sekarang: { dari, sampai: rentang.sampai },
      lalu: {
        dari: tambahHari(dari, -HARI_GRAFIK_HARIAN),
        sampai: tambahHari(dari, -1),
      },
      granularitas: "harian",
    };
  }
  const panjang = selisihHari(rentang.dari, rentang.sampai) + 1;
  return {
    sekarang: { dari: rentang.dari, sampai: rentang.sampai },
    lalu: penuh,
    granularitas: panjang > BATAS_GRAFIK_HARIAN ? "bulanan" : "harian",
  };
}

export type MetrikGrafik = "gmv" | "komisi" | "upload";

const BULAN_PENDEK = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function labelHari(t: string) {
  const [, b, h] = t.split("-").map(Number);
  return `${h} ${BULAN_PENDEK[b - 1]}`;
}

function labelBulan(t: string) {
  const [th, b] = t.split("-").map(Number);
  return `${BULAN_PENDEK[b - 1]} ${th}`;
}

function nilaiMetrik(h: HariAkun, m: MetrikGrafik): number {
  if (m === "gmv") return h.gmv;
  if (m === "komisi") return h.komisi ?? 0;
  return h.upload ?? 0;
}

/**
 * Titik grafik satu metrik dari hari demi hari.
 *
 * Hari tanpa laporan menjadi titik KOSONG (celah), bukan nol (§5.2
 * no. 4, AC8). Hari kerja tanpa laporan ditandai "tidak lapor"; hari
 * libur/izin hanya celah polos. Per bulan, bulan tanpa satu laporan
 * pun juga kosong.
 */
export function titikMetrik(
  hari: readonly HariAkun[],
  metrik: MetrikGrafik,
  granularitas: Granularitas,
): TitikGrafik[] {
  if (granularitas === "harian") {
    return hari.map((h) =>
      h.lapor
        ? { label: labelHari(h.tanggal), nilai: nilaiMetrik(h, metrik) }
        : {
            label: labelHari(h.tanggal),
            nilai: 0,
            kosong: true,
            catatan: h.hariKerja ? "tidak lapor" : "libur/izin",
            tandai: h.hariKerja,
          },
    );
  }

  const per = new Map<string, { nilai: number; lapor: number }>();
  for (const h of hari) {
    const kunci = `${h.tanggal.slice(0, 7)}-01`;
    const ada = per.get(kunci) ?? { nilai: 0, lapor: 0 };
    if (h.lapor) {
      ada.nilai += nilaiMetrik(h, metrik);
      ada.lapor += 1;
    }
    per.set(kunci, ada);
  }
  return [...per.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bulan, v]) =>
      v.lapor > 0
        ? { label: labelBulan(bulan), nilai: v.nilai }
        : {
            label: labelBulan(bulan),
            nilai: 0,
            kosong: true,
            catatan: "tidak ada laporan",
          },
    );
}

/**
 * Garis periode lalu disejajarkan per urutan titik dengan periode ini.
 * Labelnya ikut periode ini (sumbu waktunya satu); titik yang tidak
 * punya pasangan menjadi kosong. null bila periode lalu sama sekali
 * tanpa laporan — garisnya tidak digambar (E1).
 */
export function sejajarkan(
  sekarang: readonly TitikGrafik[],
  lalu: readonly TitikGrafik[],
): TitikGrafik[] | null {
  if (!lalu.some((t) => !t.kosong)) return null;
  return sekarang.map((t, i) => {
    const p = lalu[i];
    return p && !p.kosong
      ? { label: t.label, nilai: p.nilai }
      : {
          label: t.label,
          nilai: 0,
          kosong: true,
          catatan: "tidak ada laporan",
        };
  });
}
