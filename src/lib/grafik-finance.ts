/**
 * Data tujuh grafik utama dasbor Finance (PRD Fase 4).
 *
 * Semua seri dibangun dari `MasukanKpi` yang sama dengan kartu KPI —
 * tidak ada perhitungan kedua. Kalau grafiknya bercerita lain dari
 * angkanya, itu bug, bukan sudut pandang.
 */
import {
  arusKasOperasi,
  labaBersihSetelahDepresiasi,
  labaOperasi,
  type MasukanKpi,
} from "@/lib/kpi-finance";
import type {
  BagianKomposisi,
  KolomKomposisi,
  TitikGrafik,
} from "@/lib/grafik";

// Bentuk titik dan kolom pindah ke `lib/grafik.ts` supaya komponen
// bersama tidak perlu mengimpor modul Finance hanya untuk tahu bentuk
// sebuah titik. Diekspor ulang di sini agar pemanggil lama tetap jalan.
export type {
  BagianKomposisi,
  KolomKomposisi,
  TitikGrafik,
} from "@/lib/grafik";

export type SeriGrafik = {
  revenue: TitikGrafik[];
  grossProfit: TitikGrafik[];
  labaOperasi: TitikGrafik[];
  labaBersih: TitikGrafik[];
  npm: TitikGrafik[];
  arusKas: TitikGrafik[];
  komposisi: KolomKomposisi[];
};

const bulat = (n: number) => Math.round(n * 10) / 10;

/**
 * Menyusun seluruh seri grafik dari riwayat periode.
 *
 * `label` berpasangan dengan `riwayat` menurut urutannya — keduanya
 * disusun di pemanggil karena hanya di sanalah jenis periodenya
 * diketahui.
 */
export function seriGrafik(riwayat: MasukanKpi[], label: string[]): SeriGrafik {
  const titik = (ambil: (m: MasukanKpi) => number): TitikGrafik[] =>
    riwayat.map((m, i) => ({
      label: label[i] ?? "",
      nilai: bulat(ambil(m)),
    }));

  return {
    revenue: titik((m) => m.sekarang.pendapatan),
    grossProfit: titik((m) => m.sekarang.netRevenue),
    labaOperasi: titik((m) => labaOperasi(m.sekarang)),
    labaBersih: titik((m) =>
      labaBersihSetelahDepresiasi(m.sekarang, m.depresiasi),
    ),
    npm: titik((m) => {
      const laba = labaBersihSetelahDepresiasi(m.sekarang, m.depresiasi);
      return m.sekarang.netRevenue > 0
        ? (laba / m.sekarang.netRevenue) * 100
        : 0;
    }),
    arusKas: titik((m) => arusKasOperasi(m.sekarang)),
    komposisi: riwayat.map((m, i) => {
      const bagian: BagianKomposisi[] = [
        {
          label: "Direct cost",
          nilai: m.sekarang.directCost,
          warna: "bg-unit-tap",
        },
        {
          label: "Creator share",
          nilai: m.sekarang.creatorShare,
          warna: "bg-warn",
        },
        { label: "Beban", nilai: m.sekarang.beban, warna: "bg-danger" },
        { label: "Depresiasi", nilai: m.depresiasi, warna: "bg-secondary" },
      ];

      return {
        label: label[i] ?? "",
        bagian,
        total: bagian.reduce((n, b) => n + b.nilai, 0),
      };
    }),
  };
}
