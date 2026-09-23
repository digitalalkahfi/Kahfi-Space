import type { TrenTigaHari } from "@/lib/batas-minimum";

/**
 * Capaian pribadi di Beranda (PRD Fase 2) — aturan murni.
 *
 * Yang dijawab kartu ini cuma satu: "sampai hari ini, saya di mana
 * terhadap target saya?" Karena itu angkanya kumulatif sepanjang jendela
 * yang sama dengan grafiknya — bukan angka hari ini, yang sudah punya
 * tempatnya sendiri di kartu WRM.
 */
import type { KolomLaporan } from "@/lib/laporan";

/** Panjang jendela diagram batang, dalam hari. */
export const HARI_DIAGRAM = 28;

export type WarnaCapaian = "hijau" | "kuning" | "merah";

/**
 * Ambangnya dari PRD: hijau ≥100%, kuning 80–99%, merah di bawah 80%.
 * Tanpa target, tidak ada yang bisa dinilai — dan "merah" akan berbohong.
 */
export function warnaCapaian(
  rasio: number,
  adaTarget = true,
): WarnaCapaian | null {
  if (!adaTarget) return null;
  if (rasio >= 100) return "hijau";
  if (rasio >= 80) return "kuning";
  return "merah";
}

export const GAYA_CAPAIAN: Record<
  WarnaCapaian,
  { pil: string; bar: string; teks: string }
> = {
  hijau: { pil: "bg-ok-fill text-ok-text", bar: "bg-ok", teks: "text-ok-text" },
  kuning: {
    pil: "bg-warn-fill text-warn-text",
    bar: "bg-warn",
    teks: "text-warn-text",
  },
  merah: {
    pil: "bg-danger-fill text-danger-text",
    bar: "bg-danger",
    teks: "text-danger-text",
  },
};

/** Satu angka yang ditampilkan di kartu capaian. */
export type AngkaCapaian = {
  kunci: KolomLaporan;
  label: string;
  /** Akumulasi sepanjang jendela. */
  realisasi: number;
  /** Akumulasi target dari GRD; null berarti belum ada targetnya. */
  target: number | null;
  satuan: "rupiah" | "cacah";
};

/** Satu hari pada diagram batang. */
export type HariCapaian = {
  tanggal: string;
  target: number;
  realisasi: number;
};

/** Satu hari pada diagram unggahan pribadi. */
export type HariUnggahan = {
  tanggal: string;
  /** null bila hari itu tidak ada laporan sama sekali. */
  unggahan: number | null;
};

export type CapaianPribadi = {
  /** Sasaran yang diringkas, mis. "@skincare_official & 1 akun lain". */
  lingkup: string;
  dari: string;
  sampai: string;
  angka: AngkaCapaian[];
  harian: HariCapaian[];
  /**
   * Unggahan harian pada jendela yang sama; kosong bagi departemen yang
   * memang tidak melaporkan unggahan (MCN & TAP).
   */
  unggahan: HariUnggahan[];
  /**
   * Batas minimum unggahan per hari bagi orang ini — jumlah batas
   * seluruh akun yang ia pegang, karena angka hariannya juga jumlah
   * seluruh akun itu. null bila tidak satu pun akunnya berlevel.
   */
  minimumHarian: number | null;
  /**
   * Tren tiga hari kerja terakhir tiap akun yang ia pegang; kosong bila
   * ia memang tidak memegang akun berlevel.
   */
  tren: TrenTigaHari[];
};

/** Jendela `HARI_DIAGRAM` hari yang berakhir pada `sampai`. */
export function rentangDiagram(sampai: string, hari = HARI_DIAGRAM) {
  const akhir = new Date(`${sampai}T00:00:00Z`);
  const awal = new Date(akhir);
  awal.setUTCDate(awal.getUTCDate() - (hari - 1));
  return { dari: awal.toISOString().slice(0, 10), sampai };
}

/** Deretan tanggal jendela, termasuk hari yang tidak ada laporannya. */
export function hariJendela(sampai: string, hari = HARI_DIAGRAM): string[] {
  const { dari } = rentangDiagram(sampai, hari);
  const d = new Date(`${dari}T00:00:00Z`);
  return Array.from({ length: hari }, () => {
    const teks = d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
    return teks;
  });
}

export function rasioCapaianAngka(a: AngkaCapaian): number | null {
  if (a.target === null || a.target <= 0) return null;
  return (a.realisasi / a.target) * 100;
}

/** Jumlah target & realisasi sepanjang jendela. */
export function totalHarian(harian: HariCapaian[]) {
  return harian.reduce(
    (a, h) => ({
      target: a.target + h.target,
      realisasi: a.realisasi + h.realisasi,
    }),
    { target: 0, realisasi: 0 },
  );
}

/**
 * Label sasaran yang diringkas kartu. Satu akun disebut namanya; lebih
 * dari satu disebut berapa banyak, karena menuliskan semuanya membuat
 * judul kartu lebih panjang dari angkanya.
 */
export function lingkupCapaian(nama: string[]): string {
  if (nama.length === 0) return "Belum ada sasaran";
  if (nama.length === 1) return nama[0];
  return `${nama[0]} & ${nama.length - 1} lainnya`;
}
