import type { SatuanGrafik, TitikGrafik } from "@/lib/grafik";
import type { KodeUnit } from "@/lib/types";
import { gayaUnit } from "@/lib/unit";

/**
 * Analitik GMV harian.
 *
 * Sumbernya laporan manual yang sudah ada (`daily_reports`) — bukan
 * tarikan otomatis dari TikTok/Shopee, dan bukan tabel baru. Itu penting
 * disebut di layar juga: angka di sini sekuat disiplin pelaporan
 * hariannya, tidak lebih.
 */

/** Satu baris laporan sebagaimana dibutuhkan analitik ini. */
export type BarisGmv = {
  tanggal: string;
  gmv: number;
  target: number;
  unitId: KodeUnit | null;
  label: string;
};

/** Satu laporan penyusun sebuah hari — siapa, dari unit mana, berapa. */
export type PenyusunHari = {
  label: string;
  gmv: number;
  unitId: KodeUnit | null;
};

export type TitikGmv = {
  tanggal: string;
  /** Label pendek untuk sumbu, mis. "24 Okt". */
  label: string;
  gmv: number;
  target: number;
  /** Berapa laporan menyusun angka hari itu. */
  jumlahLaporan: number;
  /**
   * Laporan penyusunnya, terbesar lebih dulu.
   *
   * Ada supaya tiap angka di grafik bisa ditelusuri sampai ke
   * pelapornya: "kenapa Rabu turun" tidak bisa dijawab oleh satu angka
   * gabungan.
   */
  penyusun: PenyusunHari[];
};

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

/** "2024-10-24" → "24 Okt". Tanpa Date supaya bebas zona waktu. */
export function labelTanggal(tanggal: string): string {
  const [, bulan, hari] = tanggal.split("-");
  const i = Number(bulan) - 1;
  return `${Number(hari)} ${BULAN_PENDEK[i] ?? bulan}`;
}

/**
 * Laporan per akun/unit → satu titik per HARI.
 *
 * Dijumlahkan per tanggal karena grafiknya bercerita tentang hari, bukan
 * tentang siapa yang melapor. Hari tanpa laporan sengaja TIDAK diisi
 * nol: nol berarti "jualan nihil", sedangkan yang sebenarnya terjadi
 * adalah "tidak ada yang melapor" — dua hal yang sangat berbeda bagi
 * orang yang membaca grafiknya.
 */
export function seriHarian(baris: BarisGmv[]): TitikGmv[] {
  const perHari = new Map<
    string,
    { gmv: number; target: number; penyusun: PenyusunHari[] }
  >();

  for (const b of baris) {
    const ada = perHari.get(b.tanggal) ?? { gmv: 0, target: 0, penyusun: [] };
    ada.gmv += b.gmv;
    ada.target += b.target;
    ada.penyusun.push({ label: b.label, gmv: b.gmv, unitId: b.unitId });
    perHari.set(b.tanggal, ada);
  }

  return [...perHari.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tanggal, n]) => ({
      tanggal,
      label: labelTanggal(tanggal),
      gmv: n.gmv,
      target: n.target,
      jumlahLaporan: n.penyusun.length,
      penyusun: [...n.penyusun].sort((a, b) => b.gmv - a.gmv),
    }));
}

export type RingkasGmv = {
  total: number;
  rataRata: number;
  hariTerlapor: number;
  tertinggi: TitikGmv | null;
  terendah: TitikGmv | null;
  totalTarget: number;
  /** Rasio capaian terhadap target pada hari-hari yang terlapor. */
  capaian: number;
};

/**
 * Angka ringkas sebuah periode.
 *
 * Rata-rata dibagi HARI TERLAPOR, bukan panjang rentangnya. Membagi
 * dengan panjang rentang membuat pekan yang laporannya bolong terlihat
 * seperti pekan yang penjualannya turun.
 */
export function ringkasGmv(titik: TitikGmv[]): RingkasGmv {
  if (titik.length === 0) {
    return {
      total: 0,
      rataRata: 0,
      hariTerlapor: 0,
      tertinggi: null,
      terendah: null,
      totalTarget: 0,
      capaian: 0,
    };
  }

  const total = titik.reduce((a, t) => a + t.gmv, 0);
  const totalTarget = titik.reduce((a, t) => a + t.target, 0);
  const urut = [...titik].sort((a, b) => a.gmv - b.gmv);

  return {
    total,
    rataRata: Math.round(total / titik.length),
    hariTerlapor: titik.length,
    tertinggi: urut.at(-1) ?? null,
    terendah: urut[0] ?? null,
    totalTarget,
    capaian: totalTarget > 0 ? (total / totalTarget) * 100 : 0,
  };
}

export type Arah = "naik" | "turun" | "tetap";

export type Banding = {
  arah: Arah;
  selisih: number;
  /** Persen perubahan; 0 bila pembanding nol. */
  persen: number;
  /** Tidak ada pembanding sama sekali (periode sebelumnya kosong). */
  tanpaPembanding: boolean;
};

/**
 * Membandingkan dua periode.
 *
 * Periode sebelumnya yang kosong TIDAK dilaporkan sebagai kenaikan
 * 100%: naik dari nol laporan bukan prestasi, melainkan tanda tidak ada
 * yang bisa dibandingkan.
 */
export function bandingkan(sekarang: number, sebelumnya: number): Banding {
  const selisih = sekarang - sebelumnya;
  const arah: Arah = selisih > 0 ? "naik" : selisih < 0 ? "turun" : "tetap";

  if (sebelumnya === 0) {
    return { arah, selisih, persen: 0, tanpaPembanding: true };
  }
  return {
    arah,
    selisih,
    persen: (selisih / Math.abs(sebelumnya)) * 100,
    tanpaPembanding: false,
  };
}

/** Titik grafik untuk `GrafikGaris` — hanya label dan nilai. */
export function keTitikGrafik(titik: TitikGmv[]): TitikGrafik[] {
  return titik.map((t) => ({ label: t.label, nilai: t.gmv }));
}

/** Garis target sejajar, untuk dipasang sebagai pembanding. */
export function keTitikTarget(titik: TitikGmv[]): TitikGrafik[] {
  return titik.map((t) => ({ label: t.label, nilai: t.target }));
}

/** Apakah ada target sama sekali pada periode ini? */
export function adaTarget(titik: TitikGmv[]): boolean {
  return titik.some((t) => t.target > 0);
}

/** Rekap per unit dalam satu periode, terbesar lebih dulu. */
export function rekapUnit(baris: BarisGmv[]) {
  const per = new Map<string, { unitId: KodeUnit | null; gmv: number }>();
  for (const b of baris) {
    const kunci = b.unitId ?? "lainnya";
    const ada = per.get(kunci) ?? { unitId: b.unitId, gmv: 0 };
    ada.gmv += b.gmv;
    per.set(kunci, ada);
  }
  return [...per.values()].sort((a, b) => b.gmv - a.gmv);
}

/**
 * Titik grafik dari agregat basis data.
 *
 * Bentuk hasilnya sama dengan `seriHarian`, hanya tanpa `penyusun`:
 * rincian per laporan tidak ikut ditarik untuk rentang panjang, dan
 * daftar kosong lebih jujur daripada daftar yang seolah-olah lengkap.
 */
export function seriDariAgregat(
  agregat: { tanggal: string; gmv: number; jumlahLaporan: number }[],
  target: (tanggal: string) => number = () => 0,
): TitikGmv[] {
  return [...agregat]
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    .map((a) => ({
      tanggal: a.tanggal,
      label: labelTanggal(a.tanggal),
      gmv: a.gmv,
      target: target(a.tanggal),
      jumlahLaporan: a.jumlahLaporan,
      penyusun: [],
    }));
}

/* ------------------------------------------------------------------ *
 * Kekasaran titik grafik
 * ------------------------------------------------------------------ */

export type Granularitas = "harian" | "mingguan" | "bulanan";

export const LABEL_GRANULARITAS: Record<Granularitas, string> = {
  harian: "per hari",
  mingguan: "per pekan",
  bulanan: "per bulan",
};

/**
 * Seberapa kasar titik grafik untuk rentang sepanjang `hari`.
 *
 * Satu titik per hari benar untuk sepekan dan menyesatkan untuk
 * setahun: 366 titik pada lebar 300px berarti tiap titik kurang dari
 * satu piksel, dan yang terlihat bukan tren melainkan pagar. Ambangnya
 * dipilih supaya jumlah titik selalu tinggal di kisaran yang masih bisa
 * dibaca mata — kira-kira 10 sampai 60.
 */
export function granularitasUntuk(hari: number): Granularitas {
  if (hari <= 62) return "harian";
  if (hari <= 366) return "mingguan";
  return "bulanan";
}

/** Senin pada pekan sebuah tanggal — sejalan `rentangPeriode` mingguan. */
export function awalPekan(tanggal: string): string {
  const [t, b, h] = tanggal.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h));
  // getUTCDay(): 0 Minggu … 6 Sabtu. Senin sebagai awal pekan.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Tanggal 1 pada bulan sebuah tanggal. */
export function awalBulan(tanggal: string): string {
  return `${tanggal.slice(0, 7)}-01`;
}

function labelPekan(senin: string): string {
  return `${labelTanggal(senin)}`;
}

const BULAN_PANJANG = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function labelBulan(awal: string): string {
  const [tahun, bulan] = awal.split("-");
  return `${BULAN_PANJANG[Number(bulan) - 1]} ${tahun}`;
}

/**
 * Menggabungkan titik harian jadi pekan atau bulan.
 *
 * Yang dijumlahkan hanya GMV, target, dan jumlah laporan. `penyusun`
 * sengaja dikosongkan: daftar pelapor sepanjang sebulan bukan rincian,
 * ia daftar belanja — dan rinciannya memang hanya ditawarkan pada
 * rentang pendek (lihat BATAS_RINCI_HARI di lib/data/gmv.ts).
 */
export function kelompokkanSeri(
  titik: TitikGmv[],
  granularitas: Granularitas,
): TitikGmv[] {
  if (granularitas === "harian") return titik;

  const kunciDari =
    granularitas === "mingguan"
      ? (t: string) => awalPekan(t)
      : (t: string) => awalBulan(t);
  const labelDari = granularitas === "mingguan" ? labelPekan : labelBulan;

  const per = new Map<
    string,
    { gmv: number; target: number; jumlahLaporan: number }
  >();

  for (const t of titik) {
    const kunci = kunciDari(t.tanggal);
    const ada = per.get(kunci) ?? { gmv: 0, target: 0, jumlahLaporan: 0 };
    ada.gmv += t.gmv;
    ada.target += t.target;
    ada.jumlahLaporan += t.jumlahLaporan;
    per.set(kunci, ada);
  }

  return [...per.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tanggal, n]) => ({
      tanggal,
      label: labelDari(tanggal),
      gmv: n.gmv,
      target: n.target,
      jumlahLaporan: n.jumlahLaporan,
      penyusun: [],
    }));
}

/* ------------------------------------------------------------------ *
 * Pembanding yang sepadan
 * ------------------------------------------------------------------ */

/**
 * Potong rentang pembanding agar sepadan dengan periode berjalan.
 *
 * Masalahnya nyata: pada tanggal 8, "bulan ini" baru berisi 7 hari
 * sementara "bulan lalu" berisi 30. Membandingkan keduanya apa adanya
 * selalu menghasilkan penurunan besar yang bukan penurunan penjualan —
 * dan angka merah itu akan dipercaya orang.
 *
 * Yang dipotong hanya SISI AKHIR pembandingnya, sepanjang hari yang
 * sudah berjalan pada periode sekarang. Periode yang sudah lewat penuh
 * tidak dipotong sama sekali.
 */
export function potongSepadan(
  pembanding: { dari: string; sampai: string },
  sekarang: { dari: string; sampai: string },
  hariIni: string,
): { dari: string; sampai: string; dipotong: boolean } {
  // Periode sekarang sudah lewat seluruhnya: bandingkan penuh lawan penuh.
  if (sekarang.sampai <= hariIni) {
    return { ...pembanding, dipotong: false };
  }
  // Periode sekarang belum mulai: tidak ada yang sepadan untuk dipotong.
  if (sekarang.dari > hariIni) {
    return { ...pembanding, dipotong: false };
  }

  const berjalan = selisihHari(sekarang.dari, hariIni); // 0 = hari pertama
  const sampaiBaru = tambahHari(pembanding.dari, berjalan);
  if (sampaiBaru >= pembanding.sampai) {
    return { ...pembanding, dipotong: false };
  }
  return { dari: pembanding.dari, sampai: sampaiBaru, dipotong: true };
}

/** Selisih hari antara dua tanggal ISO (b − a). */
export function selisihHari(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}

/** Tambah `n` hari ke sebuah tanggal ISO, bebas zona waktu. */
export function tambahHari(tanggal: string, n: number): string {
  const [t, b, h] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(t, b - 1, h + n)).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ *
 * Validasi rentang kustom
 * ------------------------------------------------------------------ */

/**
 * Rentang terpanjang yang boleh diminta sekaligus: lima tahun.
 *
 * Bukan batas teknis — basis data sanggup lebih — melainkan batas akal
 * sehat. Permintaan sepanjang puluhan tahun hampir selalu salah ketik
 * pada tahunnya, dan menjawabnya dengan tabel kosong raksasa lebih
 * membingungkan daripada menolaknya.
 */
export const RENTANG_MAKS_HARI = 366 * 5;

/** Tahun paling awal yang masuk akal; sistem ini belum ada sebelumnya. */
export const TAHUN_MULAI = 2020;

export type PeriksaRentang = { ok: true } | { ok: false; pesan: string };

/**
 * Apakah rentang kustom ini layak diproses.
 *
 * Layar boleh memaafkan — ia menukar tanggal terbalik dan memberi tahu.
 * Endpoint tidak: skrip yang menukar `dari` dan `sampai` lebih baik
 * mendapat penolakan yang menyebutkan masalahnya daripada diam-diam
 * menerima rentang yang bukan ia minta.
 */
export function periksaRentangKustom(
  dari: string,
  sampai: string,
): PeriksaRentang {
  const pola = /^\d{4}-\d{2}-\d{2}$/;
  if (!pola.test(dari) || !pola.test(sampai)) {
    return { ok: false, pesan: "Tanggal harus berformat YYYY-MM-DD." };
  }
  // Tanggal yang lolos pola tapi tidak ada di kalender, mis. 2024-02-31.
  for (const [nama, nilai] of [
    ["dari", dari],
    ["sampai", sampai],
  ] as const) {
    const d = new Date(`${nilai}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== nilai) {
      return { ok: false, pesan: `Tanggal "${nama}" tidak ada di kalender.` };
    }
  }

  if (sampai < dari) {
    return {
      ok: false,
      pesan: "Tanggal selesai mendahului tanggal mulai.",
    };
  }
  if (Number(dari.slice(0, 4)) < TAHUN_MULAI) {
    return {
      ok: false,
      pesan: `Tidak ada laporan sebelum ${TAHUN_MULAI}; periksa lagi tahunnya.`,
    };
  }

  const hari = selisihHari(dari, sampai) + 1;
  if (hari > RENTANG_MAKS_HARI) {
    return {
      ok: false,
      pesan: `Rentang ${hari} hari terlalu panjang; maksimal ${RENTANG_MAKS_HARI} hari.`,
    };
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Seri per lini bisnis
 * ------------------------------------------------------------------ */

export type SeriUnit = {
  unitId: KodeUnit;
  nama: string;
  /** Titik harian lini ini, sejajar dengan tanggal seri gabungan. */
  titik: TitikGrafik[];
  total: number;
  rataRata: number;
  hariTerlapor: number;
  tertinggi: { label: string; nilai: number } | null;
  terendah: { label: string; nilai: number } | null;
};

export const NAMA_UNIT: Record<KodeUnit, string> = {
  affiliator: "Affiliator",
  mcn: "MCN",
  tap: "TAP",
};

/** Urutan tetap supaya warna dan legendanya tidak berpindah-pindah. */
export const URUTAN_UNIT: KodeUnit[] = ["affiliator", "mcn", "tap"];

export type BarisUnitHarian = {
  tanggal: string;
  unitId: KodeUnit;
  gmv: number;
};

/**
 * Satu garis per lini bisnis, semuanya memakai sumbu tanggal yang sama.
 *
 * Tanggal diambil dari `titik` gabungan, bukan dari masing-masing lini.
 * Kalau tiap garis memakai sumbunya sendiri, dua garis dengan jumlah
 * titik berbeda akan tergambar sejajar padahal tanggalnya bergeser —
 * dan yang terbaca adalah perbandingan yang tidak pernah terjadi.
 *
 * Hari yang lininya tidak melapor diisi 0 DI GRAFIK saja: garis harus
 * utuh untuk bisa dibaca. Angka ringkasnya tetap dihitung dari hari
 * yang benar-benar terlapor.
 */
export function seriPerUnit(
  titik: TitikGmv[],
  baris: BarisUnitHarian[],
): SeriUnit[] {
  const tanggal = titik.map((t) => t.tanggal);
  const label = new Map(titik.map((t) => [t.tanggal, t.label]));

  const per = new Map<KodeUnit, Map<string, number>>();
  for (const b of baris) {
    const ada = per.get(b.unitId) ?? new Map<string, number>();
    ada.set(b.tanggal, (ada.get(b.tanggal) ?? 0) + b.gmv);
    per.set(b.unitId, ada);
  }

  return URUTAN_UNIT.filter((u) => (per.get(u)?.size ?? 0) > 0).map(
    (unitId) => {
      const nilaiPerTanggal = per.get(unitId)!;
      const terlapor = [...nilaiPerTanggal.entries()]
        .filter(([t]) => label.has(t))
        .map(([t, nilai]) => ({ label: label.get(t)!, nilai }));
      const urut = [...terlapor].sort((a, b) => a.nilai - b.nilai);
      const total = terlapor.reduce((a, x) => a + x.nilai, 0);

      return {
        unitId,
        nama: NAMA_UNIT[unitId],
        titik: tanggal.map((t) => ({
          label: label.get(t) ?? t,
          nilai: nilaiPerTanggal.get(t) ?? 0,
        })),
        total,
        rataRata: terlapor.length > 0 ? Math.round(total / terlapor.length) : 0,
        hariTerlapor: terlapor.length,
        tertinggi: urut.at(-1) ?? null,
        terendah: urut[0] ?? null,
      };
    },
  );
}

/**
 * Menggabungkan baris per-unit mengikuti kekasaran grafiknya.
 *
 * Dipakai saat titiknya dikelompokkan jadi pekan atau bulan: garis per
 * lini harus ikut dikelompokkan, kalau tidak jumlah titiknya berbeda
 * dari sumbunya.
 */
export function kelompokkanPerUnit(
  baris: BarisUnitHarian[],
  granularitas: Granularitas,
): BarisUnitHarian[] {
  if (granularitas === "harian") return baris;

  const kunciDari =
    granularitas === "mingguan"
      ? (t: string) => awalPekan(t)
      : (t: string) => awalBulan(t);

  const per = new Map<string, BarisUnitHarian>();
  for (const b of baris) {
    const kunci = `${kunciDari(b.tanggal)}|${b.unitId}`;
    const ada = per.get(kunci);
    if (ada) ada.gmv += b.gmv;
    else
      per.set(kunci, {
        tanggal: kunciDari(b.tanggal),
        unitId: b.unitId,
        gmv: b.gmv,
      });
  }
  return [...per.values()];
}

/* ------------------------------------------------------------------ *
 * Metrik yang bisa dipilih
 * ------------------------------------------------------------------ */

/** Total GMV tiap lini pada sekumpulan baris harian. */
export function totalPerUnit(
  baris: BarisUnitHarian[],
): Partial<Record<KodeUnit, number>> {
  const per: Partial<Record<KodeUnit, number>> = {};
  for (const b of baris) per[b.unitId] = (per[b.unitId] ?? 0) + b.gmv;
  return per;
}

export type MetrikGmv = {
  kunci: string;
  nama: string;
  /** "lini" = satu unit bisnis; dipakai memilih centang bawaan. */
  kelompok: "utama" | "lini";
  satuan: SatuanGrafik;
  /** Angka besar di kartu: agregat seluruh periode. */
  nilai: number;
  /**
   * Agregat periode pembanding, atau null bila memang tidak ada yang
   * bisa dibandingkan. Null BUKAN nol — nol berarti "periode lalu
   * memang kosong", dan itu cerita yang berbeda.
   */
  sebelumnya: number | null;
  /** Pengganti angka perbandingan saat `sebelumnya` null. */
  catatan?: string;
  warna: string;
  warnaLegenda: string;
  putus?: boolean;
  titik: TitikGrafik[];
};

/**
 * Daftar metrik yang boleh dicentang untuk digambar.
 *
 * Yang masuk hanya besaran yang benar-benar punya deret harian —
 * "hari tertinggi" adalah sebuah angka, bukan sebuah garis, dan
 * memasukkannya ke daftar ini akan menjanjikan grafik yang tidak
 * pernah bisa digambar.
 *
 * Target ikut, tapi tanpa pembanding: sistem tidak menyimpan target
 * per tanggal (lihat catatan di dasbor), jadi target periode lalu
 * hanyalah target hari ini dikalikan jumlah harinya — angka yang
 * kelihatan seperti perbandingan padahal bukan.
 */
export function metrikGmv({
  titik,
  seriLini,
  sebelum,
  sebelumLini,
}: {
  titik: TitikGmv[];
  seriLini: SeriUnit[];
  sebelum: { gmv: number; jumlahLaporan: number };
  sebelumLini: Partial<Record<KodeUnit, number>>;
}): MetrikGmv[] {
  const jumlah = (ambil: (t: TitikGmv) => number) =>
    titik.reduce((a, t) => a + ambil(t), 0);

  const daftar: MetrikGmv[] = [
    {
      kunci: "gmv",
      nama: "GMV",
      kelompok: "utama",
      satuan: "rupiah",
      nilai: jumlah((t) => t.gmv),
      sebelumnya: sebelum.gmv,
      // Bukan `secondary`: birunya sama persis dengan warna MCN, dan
      // dua garis berbeda arti dengan warna yang sama adalah salah
      // baca yang menunggu terjadi.
      warna: "stroke-primary",
      warnaLegenda: "bg-primary",
      titik: keTitikGrafik(titik),
    },
  ];

  if (adaTarget(titik)) {
    daftar.push({
      kunci: "target",
      nama: "Target",
      kelompok: "utama",
      satuan: "rupiah",
      nilai: jumlah((t) => t.target),
      sebelumnya: null,
      catatan: "target berjalan, tanpa riwayat per tanggal",
      warna: "stroke-muted-foreground/70",
      warnaLegenda: "bg-muted-foreground/70",
      putus: true,
      titik: keTitikTarget(titik),
    });
  }

  daftar.push({
    kunci: "laporan",
    nama: "Laporan masuk",
    kelompok: "utama",
    satuan: "angka",
    nilai: jumlah((t) => t.jumlahLaporan),
    sebelumnya: sebelum.jumlahLaporan,
    warna: "stroke-ok",
    warnaLegenda: "bg-ok",
    titik: titik.map((t) => ({ label: t.label, nilai: t.jumlahLaporan })),
  });

  for (const s of seriLini) {
    daftar.push({
      kunci: s.unitId,
      nama: s.nama,
      kelompok: "lini",
      satuan: "rupiah",
      nilai: s.total,
      sebelumnya: sebelumLini[s.unitId] ?? 0,
      warna: gayaUnit[s.unitId].garis,
      warnaLegenda: gayaUnit[s.unitId].bar,
      titik: s.titik,
    });
  }

  return daftar;
}
