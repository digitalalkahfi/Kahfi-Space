/**
 * Keterangan tiap unit pelaporan — modul murni.
 *
 * Kode unit ('affiliator' | 'mcn' | 'tap') muncul di mana-mana sebagai
 * huruf kecil tanpa keterangan. Di halaman yang memang menjelaskan
 * susunan organisasi, kode itu perlu dibaca sebagai kalimat: apa yang
 * dikerjakannya, dan bagaimana ia melapor.
 */
import type { KodeUnit } from "@/lib/types";

export type KeteranganUnit = {
  kode: KodeUnit;
  nama: string;
  ringkas: string;
  /**
   * Sasaran laporan hariannya: per akun (tiap PIC melapor akunnya) atau
   * per unit (Leader melapor sekali untuk seluruh unit).
   */
  lapor: "akun" | "unit";
  /** Kolom laporan yang dipakai unit ini di luar GMV. */
  kolomTambahan: string[];
};

export const UNIT_PELAPORAN: Record<KodeUnit, KeteranganUnit> = {
  affiliator: {
    kode: "affiliator",
    nama: "Affiliator Network",
    ringkas:
      "Jaringan akun affiliate: tiap akun dipegang satu PIC yang mengisi laporan hariannya sendiri.",
    lapor: "akun",
    kolomTambahan: ["Komisi", "Jumlah upload", "CO sampel"],
  },
  mcn: {
    kode: "mcn",
    nama: "MCN (incl. MMC)",
    ringkas:
      "Manajemen kreator: capaiannya dilaporkan sekali untuk seluruh unit, bukan per akun.",
    lapor: "unit",
    kolomTambahan: [],
  },
  tap: {
    kode: "tap",
    nama: "TAP (TikTok Agency Partner)",
    ringkas:
      "Kemitraan agensi: seperti MCN, laporannya di tingkat unit oleh Leader-nya.",
    lapor: "unit",
    kolomTambahan: [],
  },
};

/** Kode unit yang sah; dipakai memeriksa parameter route. */
export function kodeUnitSah(nilai: unknown): nilai is KodeUnit {
  return (
    typeof nilai === "string" &&
    Object.prototype.hasOwnProperty.call(UNIT_PELAPORAN, nilai)
  );
}

/** Seluruh unit, urut seperti urutan pelaporan di PRD. */
export const DAFTAR_UNIT: KeteranganUnit[] = [
  UNIT_PELAPORAN.affiliator,
  UNIT_PELAPORAN.mcn,
  UNIT_PELAPORAN.tap,
];
