/**
 * Depresiasi sebagai entitas tersendiri (PRD Fase 3).
 *
 * Penyusutan selama ini hanya hidup di dalam kartu aset: berguna untuk
 * menjawab "laptop ini nilainya tinggal berapa", tetapi tidak menjawab
 * "berapa beban penyusutan bulan ini dan seberapa besar ia menggerus
 * laba". Modul ini memisahkannya dari beban operasional dan COGS supaya
 * ketiganya bisa dibaca sendiri-sendiri.
 *
 * Perhitungannya memakai fungsi yang sama dengan register aset — garis
 * lurus per bulan penuh, berhenti di nilai residu — jadi tidak ada versi
 * kedua yang bisa berselisih.
 */
import {
  akumulasiPenyusutan,
  bulanPenuh,
  penyusutanPerBulan,
  sudahLepas,
  type Aset,
} from "@/lib/aset";
import type { RingkasKeuangan } from "@/lib/keuangan";

/** Akhir bulan sebuah periode "2024-10" sebagai tanggal ISO. */
export function akhirPeriode(periode: string): string {
  const [tahun, bulan] = periode.split("-").map(Number);
  return new Date(Date.UTC(tahun, bulan, 0)).toISOString().slice(0, 10);
}

/** Awal bulan sebuah periode. */
export function awalPeriode(periode: string): string {
  return `${periode}-01`;
}

/**
 * Apakah sebuah aset masih menyusut sepanjang periode itu.
 *
 * Tiga hal menghentikannya: masa manfaat habis, asetnya dilepas atau
 * hilang sebelum periode itu, dan aset yang memang tidak disusutkan.
 */
export function menyusutPada(a: Aset, periode: string): boolean {
  if (a.masaManfaat <= 0) return false;
  if (a.tanggal > akhirPeriode(periode)) return false;
  if (a.berakhir && a.berakhir < awalPeriode(periode)) return false;
  return bulanPenuh(a.tanggal, akhirPeriode(periode)) <= a.masaManfaat;
}

export type BarisDepresiasi = {
  aset: Aset;
  /** Beban penyusutan aset ini pada periode tersebut. */
  beban: number;
  akumulasi: number;
  nilaiBuku: number;
  /** Bulan ke berapa dari masa manfaatnya. */
  bulanKe: number;
};

/** Beban penyusutan tiap aset pada satu periode, terbesar dulu. */
export function depresiasiPeriode(
  daftar: Aset[],
  periode: string,
): BarisDepresiasi[] {
  const akhir = akhirPeriode(periode);

  return daftar
    .filter((a) => menyusutPada(a, periode))
    .map((a) => {
      const akumulasi = akumulasiPenyusutan(a, akhir);
      return {
        aset: a,
        beban: Math.round(penyusutanPerBulan(a)),
        akumulasi,
        nilaiBuku: sudahLepas(a.status) ? 0 : a.nilaiPerolehan - akumulasi,
        bulanKe: Math.min(bulanPenuh(a.tanggal, akhir), a.masaManfaat),
      } satisfies BarisDepresiasi;
    })
    .sort((x, y) => y.beban - x.beban);
}

export type RingkasDepresiasi = {
  jumlahAset: number;
  beban: number;
  akumulasi: number;
  nilaiBuku: number;
  /** Aset yang masa manfaatnya habis dalam 3 bulan ke depan. */
  segeraHabis: number;
};

export function ringkasDepresiasi(baris: BarisDepresiasi[]): RingkasDepresiasi {
  return {
    jumlahAset: baris.length,
    beban: baris.reduce((n, b) => n + b.beban, 0),
    akumulasi: baris.reduce((n, b) => n + b.akumulasi, 0),
    nilaiBuku: baris.reduce((n, b) => n + b.nilaiBuku, 0),
    segeraHabis: baris.filter((b) => b.aset.masaManfaat - b.bulanKe <= 3)
      .length,
  };
}

export type PengaruhLaba = {
  labaSebelum: number;
  beban: number;
  labaSesudah: number;
  npmSebelum: number;
  npmSesudah: number;
  /** Selisih NPM dalam poin persen; selalu ≤ 0. */
  selisihNpm: number;
};

/**
 * Pengaruh depresiasi terhadap laba dan NPM.
 *
 * Laba bersih di modul Keuangan sengaja belum memotong penyusutan:
 * pembelian aset bukan biaya, dan mencampurnya membuat arus kas salah
 * baca. Yang tidak boleh terjadi adalah kebalikannya — melupakannya
 * sama sekali, sehingga laba terlihat lebih besar dari yang sebenarnya
 * bisa dibagikan. Halaman ini menunjukkan keduanya berdampingan.
 */
export function pengaruhLaba(
  ringkas: RingkasKeuangan,
  beban: number,
): PengaruhLaba {
  const labaSesudah = ringkas.labaBersih - beban;
  const npm = (laba: number) =>
    ringkas.netRevenue > 0
      ? Math.round((laba / ringkas.netRevenue) * 1000) / 10
      : 0;

  return {
    labaSebelum: ringkas.labaBersih,
    beban,
    labaSesudah,
    npmSebelum: npm(ringkas.labaBersih),
    npmSesudah: npm(labaSesudah),
    selisihNpm: npm(labaSesudah) - npm(ringkas.labaBersih),
  };
}

export type BarisJadwalBulanan = {
  /** Periode "2024-10". */
  periode: string;
  /** Bulan ke berapa dari masa manfaatnya. */
  bulanKe: number;
  nilaiAwal: number;
  beban: number;
  akumulasi: number;
  nilaiAkhir: number;
};

/**
 * Jadwal penyusutan bulan demi bulan untuk satu aset.
 *
 * Bebannya dihitung dari selisih akumulasi yang sudah dibulatkan, bukan
 * dari pembulatan beban tiap bulan: cara kedua menyisakan rupiah nyasar
 * di akhir masa manfaat, dan nilai akhirnya tidak persis sama dengan
 * residu yang dijanjikan.
 */
export function jadwalBulanan(a: Aset): BarisJadwalBulanan[] {
  if (a.masaManfaat <= 0) return [];

  const perBulan = penyusutanPerBulan(a);
  const [tahun, bulan] = a.tanggal.slice(0, 7).split("-").map(Number);

  let akumSebelum = 0;
  const baris: BarisJadwalBulanan[] = [];

  for (let i = 1; i <= a.masaManfaat; i += 1) {
    const d = new Date(Date.UTC(tahun, bulan - 1 + i, 1));
    const akumSesudah = Math.round(perBulan * i);

    baris.push({
      periode: d.toISOString().slice(0, 7),
      bulanKe: i,
      nilaiAwal: a.nilaiPerolehan - akumSebelum,
      beban: akumSesudah - akumSebelum,
      akumulasi: akumSesudah,
      nilaiAkhir: a.nilaiPerolehan - akumSesudah,
    });

    akumSebelum = akumSesudah;
  }

  return baris;
}

export type BarisPeriode = {
  periode: string;
  jumlahAset: number;
  beban: number;
  /** Akumulasi seluruh aset sampai akhir periode itu. */
  akumulasi: number;
  /** Periode yang belum terjadi — ramalan, bukan catatan. */
  ramalan: boolean;
};

/** Menggeser periode "2024-10" sebanyak n bulan. */
export function geserPeriode(periode: string, n: number): string {
  const [tahun, bulan] = periode.split("-").map(Number);
  return new Date(Date.UTC(tahun, bulan - 1 + n, 1)).toISOString().slice(0, 7);
}

/**
 * Beban penyusutan periode demi periode, termasuk beberapa bulan ke
 * depan.
 *
 * Bulan yang belum terjadi ditandai sebagai ramalan, bukan disamarkan:
 * angkanya memang sudah pasti — jadwalnya ditetapkan sejak aset dicatat
 * — tetapi menyebutnya "realisasi" akan keliru.
 */
export function jadwalPerPeriode(
  daftar: Aset[],
  sekarang: string,
  mundur = 3,
  maju = 3,
): BarisPeriode[] {
  const baris: BarisPeriode[] = [];

  for (let i = -mundur; i <= maju; i += 1) {
    const periode = geserPeriode(sekarang, i);
    const isi = depresiasiPeriode(daftar, periode);

    baris.push({
      periode,
      jumlahAset: isi.length,
      beban: isi.reduce((n, b) => n + b.beban, 0),
      akumulasi: daftar.reduce(
        (n, a) => n + akumulasiPenyusutan(a, akhirPeriode(periode)),
        0,
      ),
      ramalan: periode > sekarang,
    });
  }

  return baris;
}

export type KelompokStruktur =
  "pendapatan" | "cogs" | "opex" | "depresiasi" | "total" | "diluar";

export type BarisStruktur = {
  label: string;
  nilai: number;
  kelompok: KelompokStruktur;
  keterangan: string;
};

/**
 * Pemisahan tegas Revenue, COGS, Opex, Depresiasi, dan CAPEX (PRD Fase 4).
 *
 * Yang membuat NPM lama menyesatkan bukan satu kesalahan hitung,
 * melainkan tiga hal yang tercampur: direct cost dianggap beban biasa,
 * pembelian aset dianggap biaya, dan penyusutan tidak pernah muncul.
 * Di sini ketiganya berdiri sendiri-sendiri, dan yang bukan biaya
 * ditaruh di bawah garis supaya tidak ikut mengurangi laba.
 */
export function strukturKeuangan(
  r: RingkasKeuangan,
  depresiasi: number,
): BarisStruktur[] {
  const labaKotor = r.pendapatan - r.directCost - r.creatorShare;
  const labaOperasi = labaKotor - r.beban;

  return [
    {
      label: "Revenue",
      nilai: r.pendapatan,
      kelompok: "pendapatan",
      keterangan: "Uang masuk yang sudah diterima.",
    },
    {
      label: "Direct cost / COGS",
      nilai: -r.directCost,
      kelompok: "cogs",
      keterangan: "Biaya yang melekat langsung pada pendapatan akun.",
    },
    {
      label: "Creator share",
      nilai: -r.creatorShare,
      kelompok: "cogs",
      keterangan: "Bagi hasil kreator; ikut mengurangi net revenue.",
    },
    {
      label: "Gross profit",
      nilai: labaKotor,
      kelompok: "total",
      keterangan: "Net revenue — dasar perhitungan NPM.",
    },
    {
      label: "Operating expense",
      nilai: -r.beban,
      kelompok: "opex",
      keterangan: "Beban operasional: gaji, sewa, langganan.",
    },
    {
      label: "Operating profit",
      nilai: labaOperasi,
      kelompok: "total",
      keterangan: "Laba sebelum penyusutan.",
    },
    {
      label: "Depresiasi",
      nilai: -depresiasi,
      kelompok: "depresiasi",
      keterangan: "Bukan kas keluar; uangnya sudah keluar saat aset dibeli.",
    },
    {
      label: "Net profit",
      nilai: labaOperasi - depresiasi,
      kelompok: "total",
      keterangan: "Laba setelah penyusutan diperhitungkan.",
    },
    {
      label: "CAPEX (pembelian aset)",
      nilai: -r.aset,
      kelompok: "diluar",
      keterangan:
        "Mengurangi kas, bukan laba — wujudnya berpindah jadi barang.",
    },
    {
      label: "Dividen",
      nilai: -r.dividen,
      kelompok: "diluar",
      keterangan: "Pemakaian laba yang sudah jadi, bukan biaya.",
    },
  ];
}

/** Periode yang punya beban penyusutan, terbaru dulu. */
export function periodeDepresiasi(
  daftar: Aset[],
  sampai: string,
  jumlah = 6,
): string[] {
  const hasil: string[] = [];
  const [tahun, bulan] = sampai.slice(0, 7).split("-").map(Number);

  for (let i = 0; i < jumlah; i += 1) {
    const d = new Date(Date.UTC(tahun, bulan - 1 - i, 1));
    const periode = d.toISOString().slice(0, 7);
    if (daftar.some((a) => menyusutPada(a, periode))) hasil.push(periode);
  }

  return hasil;
}
