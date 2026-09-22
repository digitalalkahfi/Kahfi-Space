/**
 * Rentang tanggal untuk laporan & rekap.
 * Semua halaman memakai kosakata periode yang sama supaya tautannya
 * bisa saling dioper tanpa terjemahan.
 */
export type KunciPeriode =
  "7hari" | "30hari" | "bulan-ini" | "bulan-lalu" | "kustom";

export type Periode = {
  kunci: KunciPeriode;
  dari: string;
  sampai: string;
  label: string;
};

export const PILIHAN_PERIODE: { kunci: KunciPeriode; label: string }[] = [
  { kunci: "7hari", label: "7 hari" },
  { kunci: "30hari", label: "30 hari" },
  { kunci: "bulan-ini", label: "Bulan ini" },
  { kunci: "bulan-lalu", label: "Bulan lalu" },
];

/**
 * Semua hitungan tanggal dilakukan dalam UTC.
 *
 * `new Date("2024-10-01T00:00:00")` ditafsirkan sebagai waktu lokal, lalu
 * `toISOString()` mengubahnya ke UTC — di WIB (UTC+7) itu memundurkan
 * tanggalnya sehari. Memakai Date.UTC menghindari pergeseran itu.
 */
const iso = (d: Date) => d.toISOString().slice(0, 10);

function keUtc(tanggal: string) {
  const [t, b, h] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(t, b - 1, h));
}

function mundurHari(acuan: string, hari: number) {
  const d = keUtc(acuan);
  d.setUTCDate(d.getUTCDate() - hari);
  return iso(d);
}

function tanggalSah(nilai: unknown): nilai is string {
  return typeof nilai === "string" && /^\d{4}-\d{2}-\d{2}$/.test(nilai);
}

/**
 * Menentukan rentang dari parameter URL.
 * `acuan` adalah "hari ini" menurut aplikasi (mode demo mematoknya ke
 * tanggal data contoh, jadi rentangnya tetap berisi).
 */
export function bacaPeriode(
  acuan: string,
  params: { periode?: unknown; dari?: unknown; sampai?: unknown },
): Periode {
  const minta = typeof params.periode === "string" ? params.periode : "";

  if (
    minta === "kustom" &&
    tanggalSah(params.dari) &&
    tanggalSah(params.sampai)
  ) {
    const [dari, sampai] =
      params.dari <= params.sampai
        ? [params.dari, params.sampai]
        : [params.sampai, params.dari];
    return { kunci: "kustom", dari, sampai, label: "Periode pilihan" };
  }

  const bulanIni = `${acuan.slice(0, 7)}-01`;
  const awalBulanLalu = keUtc(bulanIni);
  awalBulanLalu.setUTCMonth(awalBulanLalu.getUTCMonth() - 1);
  const akhirBulanLalu = keUtc(bulanIni);
  akhirBulanLalu.setUTCDate(0); // hari terakhir bulan sebelumnya

  switch (minta) {
    case "7hari":
      return {
        kunci: "7hari",
        dari: mundurHari(acuan, 6),
        sampai: acuan,
        label: "7 hari terakhir",
      };
    case "bulan-ini":
      return {
        kunci: "bulan-ini",
        dari: bulanIni,
        sampai: acuan,
        label: "Bulan berjalan",
      };
    case "bulan-lalu":
      return {
        kunci: "bulan-lalu",
        dari: iso(awalBulanLalu),
        sampai: iso(akhirBulanLalu),
        label: "Bulan lalu",
      };
    default:
      return {
        kunci: "30hari",
        dari: mundurHari(acuan, 29),
        sampai: acuan,
        label: "30 hari terakhir",
      };
  }
}
