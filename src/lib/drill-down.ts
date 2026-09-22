/**
 * Drill-down dasbor Finance (PRD Fase 4).
 *
 * Angka gabungan menjawab "berapa"; drill-down menjawab "dari mana" —
 * dan itulah yang menentukan tindakan berikutnya. Semua baris dihitung
 * dari transaksi yang sama dengan KPI, hanya dikelompokkan berbeda.
 */
import {
  menggerakkanKas,
  LABEL_JENIS_KELUAR,
  type Transaksi,
} from "@/lib/keuangan";

export type DimensiDrill = "divisi" | "akun" | "jenis" | "periode";

export const LABEL_DIMENSI: Record<DimensiDrill, string> = {
  divisi: "Divisi",
  akun: "Akun affiliate",
  jenis: "Jenis pengeluaran",
  periode: "Periode",
};

export type BarisDrill = {
  label: string;
  /** Nilai mentah kelompoknya — dipakai menyusun tautan saringan. */
  kunci: string;
  pendapatan: number;
  biaya: number;
  /** Pendapatan dikurangi biaya yang melekat pada kelompok ini. */
  net: number;
  jumlahTransaksi: number;
  /** Porsi terhadap total net seluruh baris, dalam persen. */
  porsi: number;
};

/** Nilai mentah kelompok sebuah transaksi; null berarti tidak ikut. */
function kunciDari(t: Transaksi, dimensi: DimensiDrill): string | null {
  switch (dimensi) {
    case "divisi":
      return t.unitNama || "Perusahaan";
    case "akun":
      // Transaksi tanpa akun bukan "akun kosong" — ia memang bukan
      // belanja akun, jadi tidak ikut dikelompokkan di sini.
      return t.akunUsername;
    case "jenis":
      return t.jenis ?? "masuk";
    default:
      return t.tanggal.slice(0, 7);
  }
}

/** Label baca-manusia untuk sebuah kunci kelompok. */
function labelDari(kunci: string, dimensi: DimensiDrill): string {
  if (dimensi !== "jenis") return kunci;
  return kunci === "masuk"
    ? "Pemasukan"
    : LABEL_JENIS_KELUAR[kunci as keyof typeof LABEL_JENIS_KELUAR];
}

/**
 * Mengelompokkan transaksi yang sudah dibayar menurut satu dimensi.
 *
 * Hanya yang berstatus 'dibayar' yang dihitung — sama dengan aturan kas
 * di seluruh modul Keuangan.
 */
export function drillDown(
  transaksi: Transaksi[],
  dimensi: DimensiDrill,
): BarisDrill[] {
  const peta = new Map<string, BarisDrill>();

  for (const t of transaksi) {
    if (!menggerakkanKas(t)) continue;
    const kunci = kunciDari(t, dimensi);
    if (kunci === null) continue;

    const baris = peta.get(kunci) ?? {
      label: labelDari(kunci, dimensi),
      kunci,
      pendapatan: 0,
      biaya: 0,
      net: 0,
      jumlahTransaksi: 0,
      porsi: 0,
    };

    if (t.arah === "masuk") baris.pendapatan += t.jumlah;
    else baris.biaya += t.jumlah;
    baris.jumlahTransaksi += 1;
    peta.set(kunci, baris);
  }

  const hasil = [...peta.values()].map((b) => ({
    ...b,
    net: b.pendapatan - b.biaya,
  }));
  const total = hasil.reduce((n, b) => n + Math.abs(b.net), 0);

  return hasil
    .map((b) => ({
      ...b,
      porsi: total > 0 ? Math.round((Math.abs(b.net) / total) * 1000) / 10 : 0,
    }))
    .sort((x, y) =>
      dimensi === "periode" ? y.label.localeCompare(x.label) : y.net - x.net,
    );
}

/** Membaca dimensi dari URL; nilai asing jatuh ke divisi. */
export function bacaDimensi(
  nilai: string | string[] | undefined,
): DimensiDrill {
  const satu = Array.isArray(nilai) ? nilai[0] : nilai;
  return (["divisi", "akun", "jenis", "periode"] as DimensiDrill[]).includes(
    satu as DimensiDrill,
  )
    ? (satu as DimensiDrill)
    : "divisi";
}

/**
 * Saringan halaman Transaksi untuk sebuah baris drill-down.
 *
 * Dibuat di modul murni supaya tautannya bisa diuji: tautan yang salah
 * membawa orang ke daftar kosong, dan kesalahan seperti itu tidak
 * terlihat sampai ada yang mengkliknya.
 */
export function saringanDrill(
  baris: BarisDrill,
  dimensi: DimensiDrill,
): Record<string, string> {
  switch (dimensi) {
    case "divisi":
      return { unit: baris.kunci };
    case "akun":
      return { cari: baris.kunci };
    case "jenis":
      return baris.kunci === "masuk"
        ? { arah: "masuk" }
        : { jenis: baris.kunci };
    default: {
      const [tahun, bulan] = baris.kunci.split("-").map(Number);
      const akhir = new Date(Date.UTC(tahun, bulan, 0))
        .toISOString()
        .slice(0, 10);
      return { dari: `${baris.kunci}-01`, sampai: akhir };
    }
  }
}

/**
 * Query string dasbor yang dibawa serta agar bisa dipulihkan.
 *
 * Hanya parameter dasbor yang ikut; sisanya dibuang supaya tautan
 * "kembali" tidak pernah membawa saringan halaman lain.
 */
export function bekalKembali(params: URLSearchParams): string {
  const disimpan = ["periode", "acuan", "dari", "sampai", "drill", "persona"];
  const bekal = new URLSearchParams();

  for (const kunci of disimpan) {
    const nilai = params.get(kunci);
    if (nilai) bekal.set(kunci, nilai);
  }

  const query = bekal.toString();
  return query ? `?${query}` : "";
}

/** Membaca bekal kembali; hanya query string murni yang diterima. */
export function bacaKembali(nilai: string | string[] | undefined): string {
  const satu = Array.isArray(nilai) ? nilai[0] : nilai;
  if (!satu || !satu.startsWith("?")) return "";
  // Tanpa penyaringan ini, `kembali` bisa diisi alamat luar dan dipakai
  // melempar orang keluar aplikasi.
  return /^\?[A-Za-z0-9_=&%.\-+:@]*$/.test(satu) ? satu : "";
}
