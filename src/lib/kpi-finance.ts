/**
 * Sepuluh KPI dasbor eksekutif Finance (PRD Fase 4).
 *
 * Semuanya dihitung dari ringkasan keuangan yang sudah ada — tidak ada
 * sumber angka kedua. Yang ditambahkan modul ini hanya susunannya:
 * nilai periode berjalan, pembandingnya, arah, dan status.
 *
 * Satu hal yang sengaja dibedakan dari modul Keuangan: di sini laba
 * bersih sudah dipotong penyusutan. Dasbor ini untuk memutuskan berapa
 * yang bisa dibagikan, bukan untuk membaca arus kas.
 */
import { persen, rupiahPenuh, rupiahRingkas } from "@/lib/format";
import type { RingkasKeuangan } from "@/lib/keuangan";

export type FormatKpi = "rupiah" | "persen";
export type ArahKpi = "naik" | "turun" | "datar";
export type StatusKpi = "baik" | "waspada" | "buruk" | "netral";

export type KpiFinance = {
  kunci: string;
  label: string;
  nilai: number;
  format: FormatKpi;
  /** Nilai periode pembanding; null bila memang tidak ada. */
  sebelumnya: number | null;
  /** Selisih nominal terhadap pembanding. */
  selisih: number | null;
  /** Selisih relatif dalam persen; null bila pembandingnya nol. */
  selisihPersen: number | null;
  arah: ArahKpi;
  status: StatusKpi;
  keterangan: string;
  /**
   * Nilai beberapa periode terakhir, terlama dulu — untuk sparkline.
   * Kosong bila riwayatnya memang belum ada.
   */
  seri: number[];
};

export const LABEL_STATUS_KPI: Record<StatusKpi, string> = {
  baik: "Membaik",
  waspada: "Memburuk",
  buruk: "Perlu tindakan",
  netral: "Tetap",
};

export type MasukanKpi = {
  sekarang: RingkasKeuangan;
  sebelumnya: RingkasKeuangan;
  /** Beban penyusutan periode berjalan dan pembandingnya. */
  depresiasi: number;
  depresiasiLalu: number;
  /** Pagu dan realisasi anggaran periode berjalan. */
  anggaran: number;
  realisasi: number;
  /** Posisi kas perusahaan; tidak mengenal periode. */
  saldoKas: number;
};

const bagi = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const bulat = (n: number) => Math.round(n * 10) / 10;

/**
 * Arah perubahan sebuah KPI.
 *
 * `baikNaik` memisahkan "naik" dari "membaik": beban yang naik dan
 * pendapatan yang naik bergerak ke arah yang sama, tetapi hanya satu
 * yang kabar baik.
 */
function nilaiArah(selisih: number | null): ArahKpi {
  if (selisih === null || selisih === 0) return "datar";
  return selisih > 0 ? "naik" : "turun";
}

function statusDari(
  selisih: number | null,
  baikNaik: boolean,
  nilai: number,
): StatusKpi {
  if (nilai < 0) return "buruk";
  if (selisih === null || selisih === 0) return "netral";
  const membaik = baikNaik ? selisih > 0 : selisih < 0;
  return membaik ? "baik" : "waspada";
}

function buat(
  kunci: string,
  label: string,
  nilai: number,
  sebelumnya: number | null,
  format: FormatKpi,
  baikNaik: boolean,
  keterangan: string,
): KpiFinance {
  const selisih = sebelumnya === null ? null : bulat(nilai - sebelumnya);

  return {
    kunci,
    label,
    seri: [],
    nilai: bulat(nilai),
    format,
    sebelumnya: sebelumnya === null ? null : bulat(sebelumnya),
    selisih,
    selisihPersen:
      sebelumnya === null || sebelumnya === 0
        ? null
        : bulat(((nilai - sebelumnya) / Math.abs(sebelumnya)) * 100),
    arah: nilaiArah(selisih),
    status: statusDari(selisih, baikNaik, nilai),
    keterangan,
  };
}

/** Arus kas operasi: penerimaan dikurangi biaya yang benar-benar dibayar. */
export function arusKasOperasi(r: RingkasKeuangan): number {
  return r.pendapatan - r.directCost - r.creatorShare - r.beban;
}

/** Laba operasi: net revenue dikurangi beban, sebelum penyusutan. */
export function labaOperasi(r: RingkasKeuangan): number {
  return r.netRevenue - r.beban;
}

/** Laba bersih setelah penyusutan diperhitungkan. */
export function labaBersihSetelahDepresiasi(
  r: RingkasKeuangan,
  depresiasi: number,
): number {
  return labaOperasi(r) - depresiasi;
}

export function kpiFinance(m: MasukanKpi): KpiFinance[] {
  const { sekarang: s, sebelumnya: l } = m;

  const labaOperasiKini = labaOperasi(s);
  const labaOperasiLalu = labaOperasi(l);
  const labaBersihKini = labaBersihSetelahDepresiasi(s, m.depresiasi);
  const labaBersihLalu = labaBersihSetelahDepresiasi(l, m.depresiasiLalu);

  return [
    buat(
      "revenue",
      "Revenue",
      s.pendapatan,
      l.pendapatan,
      "rupiah",
      true,
      "Uang masuk yang sudah diterima pada periode ini.",
    ),
    buat(
      "revenue-growth",
      "Revenue growth",
      bagi(s.pendapatan - l.pendapatan, l.pendapatan),
      null,
      "persen",
      true,
      // Bagi-nol menghasilkan 0%, dan 0% terbaca sebagai "tidak tumbuh"
      // padahal kenyataannya tumbuh dari nol. Perbedaan itu dikatakan.
      l.pendapatan === 0
        ? s.pendapatan > 0
          ? "Periode pembanding nol — pertumbuhannya tidak bisa dipersenkan."
          : "Belum ada pendapatan di kedua periode."
        : "Pertumbuhan pendapatan terhadap periode pembanding.",
    ),
    buat(
      "gross-profit",
      "Gross profit",
      s.netRevenue,
      l.netRevenue,
      "rupiah",
      true,
      "Pendapatan setelah direct cost dan creator share.",
    ),
    buat(
      "gp-margin",
      "GP margin",
      bagi(s.netRevenue, s.pendapatan),
      bagi(l.netRevenue, l.pendapatan),
      "persen",
      true,
      "Porsi pendapatan yang tersisa sebelum beban operasional.",
    ),
    buat(
      "operating-profit",
      "Operating profit",
      labaOperasiKini,
      labaOperasiLalu,
      "rupiah",
      true,
      "Laba sebelum penyusutan diperhitungkan.",
    ),
    buat(
      "net-profit",
      "Net profit",
      labaBersihKini,
      labaBersihLalu,
      "rupiah",
      true,
      "Laba setelah penyusutan — dasar berapa yang bisa dibagikan.",
    ),
    buat(
      "npm",
      "NPM",
      bagi(labaBersihKini, s.netRevenue),
      bagi(labaBersihLalu, l.netRevenue),
      "persen",
      true,
      "Laba bersih terhadap net revenue, bukan pendapatan kotor.",
    ),
    buat(
      "cash-balance",
      "Cash balance",
      m.saldoKas,
      null,
      "rupiah",
      true,
      "Posisi kas perusahaan hari ini; tidak mengenal periode.",
    ),
    buat(
      "operating-cash-flow",
      "Operating cash flow",
      arusKasOperasi(s),
      arusKasOperasi(l),
      "rupiah",
      true,
      "Kas yang dihasilkan operasi, sebelum aset dan dividen.",
    ),
    buat(
      "budget-vs-actual",
      "Budget vs actual",
      bagi(m.realisasi, m.anggaran),
      null,
      "persen",
      // Serapan yang naik mendekati batas pagunya; itu bukan kabar baik.
      false,
      "Serapan anggaran periode ini terhadap pagunya.",
    ),
  ];
}

// ---------------------------------------------------------------------
// Format tampilan
// ---------------------------------------------------------------------

/**
 * Nilai KPI siap tampil.
 *
 * Rupiah diringkas (Rp 342,7 Jt) karena sepuluh kartu berdampingan tidak
 * muat menampilkan angka penuh; persentase memakai koma desimal gaya
 * Indonesia. Tanda minus ditulis dengan tanda minus tipografis, bukan
 * hubung, supaya tidak terbaca sebagai pemisah.
 */
export function formatNilaiKpi(kpi: KpiFinance): string {
  if (kpi.format === "persen") return persen(kpi.nilai);
  return rupiahRingkas(kpi.nilai).replace("-", "−");
}

/** Angka penuh untuk `title`: yang diringkas tetap bisa diperiksa. */
export function formatNilaiPenuh(kpi: KpiFinance): string {
  if (kpi.format === "persen") return persen(kpi.nilai, 2);
  return rupiahPenuh(kpi.nilai);
}

/**
 * Selisih terhadap pembanding, lengkap dengan tandanya.
 *
 * Selisih persentase ditulis dalam "poin", bukan persen: NPM yang naik
 * dari 50% ke 55% naik 5 poin, bukan 5% — dan perbedaan itu bukan
 * soal kata-kata, melainkan soal besaran yang berbeda sepuluh kali.
 */
export function formatSelisihKpi(kpi: KpiFinance): string | null {
  if (kpi.selisih === null) return null;

  const tanda = kpi.selisih > 0 ? "+" : kpi.selisih < 0 ? "−" : "";
  const besar = Math.abs(kpi.selisih);

  if (kpi.format === "persen") {
    return `${tanda}${besar.toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} poin`;
  }

  const relatif =
    kpi.selisihPersen === null
      ? ""
      : ` (${kpi.selisihPersen > 0 ? "+" : "−"}${Math.abs(
          kpi.selisihPersen,
        ).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%)`;

  return `${tanda}${rupiahRingkas(besar)}${relatif}`;
}

/** Nilai pembanding siap tampil; null bila KPI-nya memang tanpa pembanding. */
export function formatPembandingKpi(kpi: KpiFinance): string | null {
  if (kpi.sebelumnya === null) return null;
  return kpi.format === "persen"
    ? persen(kpi.sebelumnya)
    : rupiahRingkas(kpi.sebelumnya).replace("-", "−");
}

/**
 * Menempelkan riwayat beberapa periode ke tiap KPI.
 *
 * Sparkline menjawab pertanyaan yang tidak bisa dijawab satu pembanding:
 * apakah perubahan bulan ini kelanjutan sebuah arah, atau justru
 * pembalikan. Riwayatnya dihitung dengan fungsi yang sama, jadi tidak
 * ada kemungkinan garisnya bercerita lain dari angkanya.
 */
export function denganSeri(
  kpi: KpiFinance[],
  riwayat: MasukanKpi[],
): KpiFinance[] {
  const seri = new Map<string, number[]>();

  for (const m of riwayat) {
    for (const k of kpiFinance(m)) {
      seri.set(k.kunci, [...(seri.get(k.kunci) ?? []), k.nilai]);
    }
  }

  return kpi.map((k) => ({ ...k, seri: seri.get(k.kunci) ?? [] }));
}
