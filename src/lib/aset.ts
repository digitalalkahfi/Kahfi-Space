/**
 * Aset & inventaris — tipe & perhitungan murni, tanpa akses database.
 *
 * Aset lahir dari transaksi keuangan berjenis "aset" (PRD Rilis 2): uang
 * yang keluar untuk barang tidak mengurangi laba seperti beban, ia
 * berpindah wujud menjadi barang yang lalu menyusut. Modul ini menghitung
 * penyusutannya dan menjawab dua pertanyaan yang sebenarnya dipakai
 * sehari-hari: barang ini nilainya tinggal berapa, dan sekarang ada pada
 * siapa.
 */
import type { KodeUnit } from "@/lib/types";

export type StatusAset =
  "dipakai" | "cadangan" | "perbaikan" | "hilang" | "dilepas";

export type Aset = {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  unitKode: KodeUnit | null;
  /** "Perusahaan" untuk aset yang tidak melekat pada satu unit. */
  unitNama: string;
  /** Tanggal perolehan — awal masa penyusutan. */
  tanggal: string;
  nilaiPerolehan: number;
  /** Masa manfaat dalam bulan; 0 berarti tidak disusutkan. */
  masaManfaat: number;
  /** Nilai sisa yang diperkirakan di akhir masa manfaat. */
  residu: number;
  status: StatusAset;
  pemegangId: string | null;
  pemegangNama: string | null;
  lokasi: string;
  /**
   * Tanggal aset berhenti disusutkan: dilepas atau dinyatakan hilang.
   * Kosong selama aset masih dimiliki.
   */
  berakhir: string | null;
  /** Transaksi keuangan asalnya, bila asetnya lahir dari sana. */
  transaksiId: string | null;
  catatan: string;
};

/**
 * Satu kejadian pada sebuah aset: berpindah tangan, berpindah keadaan,
 * atau keduanya sekaligus.
 *
 * Yang dicatat pemegangnya, bukan hanya statusnya — pertanyaan yang
 * muncul saat barang tidak ketemu selalu "terakhir di tangan siapa".
 */
export type KejadianAset = {
  id: string;
  dari: StatusAset | null;
  ke: StatusAset;
  pemegangNama: string | null;
  olehNama: string | null;
  lokasi: string;
  catatan: string;
  pada: string;
};

export const LABEL_STATUS_ASET: Record<StatusAset, string> = {
  dipakai: "Dipakai",
  cadangan: "Cadangan",
  perbaikan: "Diperbaiki",
  hilang: "Hilang",
  dilepas: "Dilepas",
};

export const GAYA_STATUS_ASET: Record<
  StatusAset,
  { kelas: string; titik: string }
> = {
  dipakai: { kelas: "bg-ok-fill text-ok-text", titik: "bg-ok" },
  cadangan: { kelas: "bg-info-fill text-info-text", titik: "bg-secondary" },
  perbaikan: { kelas: "bg-warn-fill text-warn-text", titik: "bg-warn" },
  hilang: { kelas: "bg-danger-fill text-danger-text", titik: "bg-danger" },
  dilepas: {
    kelas: "bg-muted text-muted-foreground",
    titik: "bg-muted-foreground/50",
  },
};

export const STATUS_ASET: StatusAset[] = [
  "dipakai",
  "cadangan",
  "perbaikan",
  "hilang",
  "dilepas",
];

/** Aset yang sudah tidak lagi dimiliki perusahaan. */
export function sudahLepas(status: StatusAset) {
  return status === "dilepas" || status === "hilang";
}

/**
 * Perpindahan status yang masuk akal.
 *
 * Aset yang sudah dilepas tidak bisa hidup lagi — kalau barangnya kembali,
 * itu perolehan baru dengan nilai baru. Aset hilang bisa ditemukan, dan
 * itu kabar baik, bukan kejanggalan.
 */
export const LANJUTAN_ASET: Record<StatusAset, StatusAset[]> = {
  dipakai: ["cadangan", "perbaikan", "hilang", "dilepas"],
  cadangan: ["dipakai", "perbaikan", "hilang", "dilepas"],
  perbaikan: ["dipakai", "cadangan", "dilepas", "hilang"],
  hilang: ["dipakai", "cadangan", "dilepas"],
  dilepas: [],
};

export function perpindahanAsetSah(dari: StatusAset, ke: StatusAset) {
  return LANJUTAN_ASET[dari].includes(ke);
}

// ---------------------------------------------------------------------
// Penyusutan garis lurus
// ---------------------------------------------------------------------

/**
 * Jumlah bulan penuh antara dua tanggal.
 *
 * Penyusutan dihitung per bulan penuh, bukan per hari: pembukuan
 * mencatatnya sekali sebulan, dan menghitung harian hanya membuat angka
 * di layar berbeda dari angka di jurnal.
 */
export function bulanPenuh(dari: string, sampai: string): number {
  if (sampai < dari) return 0;

  const [ty, tm, td] = dari.split("-").map(Number);
  const [sy, sm, sd] = sampai.split("-").map(Number);
  const bulan = (sy - ty) * 12 + (sm - tm);

  // Tanggal 15 → 14 bulan berikutnya belum genap sebulan.
  return sd < td ? Math.max(0, bulan - 1) : bulan;
}

/** Beban penyusutan sebulan. Nol untuk aset yang tidak disusutkan. */
export function penyusutanPerBulan(a: Aset): number {
  if (a.masaManfaat <= 0) return 0;
  return Math.max(0, a.nilaiPerolehan - a.residu) / a.masaManfaat;
}

/**
 * Penyusutan yang sudah menumpuk sampai satu tanggal.
 *
 * Berhenti di dua tempat: saat masa manfaat habis (nilainya tinggal
 * residu, bukan nol atau minus) dan saat asetnya berhenti dimiliki.
 */
export function akumulasiPenyusutan(a: Aset, sampai: string): number {
  const batas = a.berakhir && a.berakhir < sampai ? a.berakhir : sampai;
  const bulan = Math.min(bulanPenuh(a.tanggal, batas), a.masaManfaat);
  return Math.round(penyusutanPerBulan(a) * bulan);
}

/**
 * Nilai buku: sisa nilai aset di pembukuan.
 *
 * Aset yang dilepas atau hilang bernilai nol — bukan karena barangnya
 * tak berharga, tetapi karena perusahaan tidak lagi memilikinya.
 */
export function nilaiBuku(a: Aset, sampai: string): number {
  if (sudahLepas(a.status)) return 0;
  return a.nilaiPerolehan - akumulasiPenyusutan(a, sampai);
}

/**
 * Nilai yang hangus saat aset hilang: nilai bukunya tepat sebelum
 * dinyatakan hilang. Inilah angka kerugiannya, bukan harga belinya.
 */
export function nilaiHangus(a: Aset, sampai: string): number {
  if (a.status !== "hilang") return 0;
  return a.nilaiPerolehan - akumulasiPenyusutan(a, sampai);
}

/** Sisa masa manfaat dalam bulan; 0 bila sudah habis atau tak disusutkan. */
export function sisaMasaManfaat(a: Aset, sampai: string): number {
  if (a.masaManfaat <= 0) return 0;
  return Math.max(0, a.masaManfaat - bulanPenuh(a.tanggal, sampai));
}

export type RingkasAset = {
  /** Aset yang masih dimiliki — dilepas dan hilang tidak ikut. */
  dimiliki: number;
  total: number;
  nilaiPerolehan: number;
  akumulasiPenyusutan: number;
  nilaiBuku: number;
  /** Diperbaiki atau hilang: dua-duanya menuntut tindakan. */
  perluPerhatian: number;
  /** Aset dipakai tanpa nama pemegang — tidak ada yang bertanggung jawab. */
  tanpaPemegang: number;
  nilaiHilang: number;
  susutBulanIni: number;
};

/**
 * Ringkasan yang menjawab pertanyaan sebenarnya: berapa nilai barang yang
 * masih dimiliki, berapa yang sudah hangus, dan berapa banyak yang tidak
 * ada penanggung jawabnya.
 */
export function ringkasAset(daftar: Aset[], sampai: string): RingkasAset {
  const dimiliki = daftar.filter((a) => !sudahLepas(a.status));

  return {
    dimiliki: dimiliki.length,
    total: daftar.length,
    nilaiPerolehan: dimiliki.reduce((n, a) => n + a.nilaiPerolehan, 0),
    akumulasiPenyusutan: dimiliki.reduce(
      (n, a) => n + akumulasiPenyusutan(a, sampai),
      0,
    ),
    nilaiBuku: dimiliki.reduce((n, a) => n + nilaiBuku(a, sampai), 0),
    perluPerhatian: daftar.filter(
      (a) => a.status === "perbaikan" || a.status === "hilang",
    ).length,
    tanpaPemegang: daftar.filter(
      (a) => a.status === "dipakai" && !a.pemegangNama,
    ).length,
    nilaiHilang: daftar.reduce((n, a) => n + nilaiHangus(a, sampai), 0),
    susutBulanIni: Math.round(
      dimiliki
        .filter((a) => sisaMasaManfaat(a, sampai) > 0)
        .reduce((n, a) => n + penyusutanPerBulan(a), 0),
    ),
  };
}

export type BarisJadwal = {
  tahun: number;
  /** Bulan penyusutan yang jatuh di tahun itu. */
  bulan: number;
  nilaiAwal: number;
  beban: number;
  nilaiAkhir: number;
};

/**
 * Jadwal penyusutan per tahun kalender.
 *
 * Bebannya dihitung dari selisih akumulasi yang sudah dibulatkan, bukan
 * dari pembulatan beban tiap tahun: cara kedua menyisakan rupiah nyasar
 * di akhir masa manfaat, dan nilai akhirnya tidak persis sama dengan
 * residu yang dijanjikan.
 */
export function jadwalPenyusutan(a: Aset): BarisJadwal[] {
  if (a.masaManfaat <= 0) return [];

  const perBulan = penyusutanPerBulan(a);
  const [tahunMulai, bulanMulai] = a.tanggal.split("-").map(Number);

  const bulanPerTahun = new Map<number, number>();
  for (let i = 0; i < a.masaManfaat; i += 1) {
    // Bulan penyusutan ke-i genap pada bulan (bulanMulai + i).
    const geser = bulanMulai - 1 + i;
    const tahun = tahunMulai + Math.floor(geser / 12);
    bulanPerTahun.set(tahun, (bulanPerTahun.get(tahun) ?? 0) + 1);
  }

  let bulanKumulatif = 0;
  let akumSebelum = 0;

  return [...bulanPerTahun.entries()]
    .sort(([x], [y]) => x - y)
    .map(([tahun, bulan]) => {
      bulanKumulatif += bulan;
      const akumSesudah = Math.round(perBulan * bulanKumulatif);
      const baris: BarisJadwal = {
        tahun,
        bulan,
        nilaiAwal: a.nilaiPerolehan - akumSebelum,
        beban: akumSesudah - akumSebelum,
        nilaiAkhir: a.nilaiPerolehan - akumSesudah,
      };
      akumSebelum = akumSesudah;
      return baris;
    });
}

export type BarisNilaiAset = {
  /** Nama kategori atau unit. */
  label: string;
  jumlah: number;
  nilaiPerolehan: number;
  akumulasiPenyusutan: number;
  nilaiBuku: number;
};

/**
 * Nilai perolehan dan nilai buku dikelompokkan.
 *
 * Satu angka besar tidak pernah cukup untuk memutuskan apa pun: yang
 * ditanyakan berikutnya selalu "nilai sebesar itu ada di mana". Aset yang
 * sudah dilepas dan hilang tidak ikut — perusahaan tidak lagi memilikinya.
 */
export function nilaiAsetPer(
  daftar: Aset[],
  sampai: string,
  kunci: (a: Aset) => string,
): BarisNilaiAset[] {
  const peta = new Map<string, BarisNilaiAset>();

  for (const a of daftar) {
    if (sudahLepas(a.status)) continue;
    const label = kunci(a);
    const baris = peta.get(label) ?? {
      label,
      jumlah: 0,
      nilaiPerolehan: 0,
      akumulasiPenyusutan: 0,
      nilaiBuku: 0,
    };

    baris.jumlah += 1;
    baris.nilaiPerolehan += a.nilaiPerolehan;
    baris.akumulasiPenyusutan += akumulasiPenyusutan(a, sampai);
    baris.nilaiBuku += nilaiBuku(a, sampai);
    peta.set(label, baris);
  }

  // Terbesar dulu: yang paling banyak menahan nilai adalah yang paling
  // sering ditanyakan.
  return [...peta.values()].sort((x, y) => y.nilaiBuku - x.nilaiBuku);
}

// ---------------------------------------------------------------------
// Isian aset
// ---------------------------------------------------------------------

export type MasukanAset = {
  kode: string;
  nama: string;
  kategori: string;
  unitKode: KodeUnit | null;
  tanggal: string;
  nilaiPerolehan: number;
  masaManfaat: number;
  residu: number;
  lokasi: string;
  catatan: string;
};

const POLA_TANGGAL_ASET = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pemeriksaan isian aset — satu tempat, dipakai layar maupun server.
 *
 * Yang dijaga di sini bukan formalitas: nilai residu yang melebihi harga
 * beli membuat penyusutannya negatif, dan masa manfaat yang keliru
 * menulis ulang seluruh nilai buku secara surut.
 */
export function periksaAset(input: MasukanAset): string | null {
  if (input.kode.trim() !== "" && !POLA_KODE_ASET.test(input.kode.trim())) {
    return "Kode aset berbentuk AST-0001.";
  }
  if (input.nama.trim().length < 3) return "Nama aset minimal 3 huruf.";
  if (!POLA_TANGGAL_ASET.test(input.tanggal)) {
    return "Tanggal perolehan tidak sah.";
  }
  if (!Number.isFinite(input.nilaiPerolehan) || input.nilaiPerolehan < 0) {
    return "Nilai perolehan tidak sah.";
  }
  if (input.nilaiPerolehan > 100_000_000_000) {
    return "Nilai perolehan di luar batas wajar, periksa lagi.";
  }
  if (!Number.isInteger(input.masaManfaat) || input.masaManfaat < 0) {
    return "Masa manfaat diisi dalam bulan, mulai dari 0.";
  }
  if (input.masaManfaat > 600) {
    return "Masa manfaat paling lama 600 bulan (50 tahun).";
  }
  if (!Number.isFinite(input.residu) || input.residu < 0) {
    return "Nilai residu tidak sah.";
  }
  if (input.residu > input.nilaiPerolehan) {
    return "Nilai residu tidak mungkin melebihi harga belinya.";
  }
  return null;
}

// ---------------------------------------------------------------------
// Perpindahan pemegang
// ---------------------------------------------------------------------

export type MasukanPerpindahanAset = {
  asetId: string;
  /** Keadaan tujuan; boleh sama dengan sekarang bila hanya ganti tangan. */
  ke: StatusAset;
  pemegangId: string | null;
  lokasi: string;
  catatan: string;
};

/** Keadaan yang menuntut keterangan sebelum dicatat. */
export const BUTUH_CATATAN: StatusAset[] = ["hilang", "dilepas"];

/**
 * Memeriksa satu perpindahan aset; mengembalikan alasan penolakan atau
 * `null` bila sah.
 *
 * Diperiksa di modul murni supaya aturannya sama di tombol maupun di
 * server action — form yang menawarkan pilihan yang pasti ditolak hanya
 * membuat orang menebak-nebak apa yang salah.
 */
export function periksaPerpindahanAset(
  input: MasukanPerpindahanAset,
  aset: Pick<Aset, "status" | "pemegangId">,
): string | null {
  if (aset.status === "dilepas") {
    return "Aset yang sudah dilepas tidak bisa diubah lagi. Barang yang kembali dicatat sebagai perolehan baru.";
  }

  const gantiKeadaan = input.ke !== aset.status;

  if (gantiKeadaan && !perpindahanAsetSah(aset.status, input.ke)) {
    return `Aset ${LABEL_STATUS_ASET[aset.status].toLowerCase()} tidak bisa langsung menjadi ${LABEL_STATUS_ASET[input.ke].toLowerCase()}.`;
  }

  if (!gantiKeadaan && input.pemegangId === aset.pemegangId) {
    return "Belum ada yang berubah: pilih pemegang baru atau keadaan yang berbeda.";
  }

  if (input.ke === "cadangan" && input.pemegangId) {
    return "Aset cadangan disimpan di gudang, bukan dipegang perorangan.";
  }

  if (input.lokasi.trim().length < 2) {
    return "Sebutkan lokasi barangnya — itulah yang dicari orang berikutnya.";
  }

  if (BUTUH_CATATAN.includes(input.ke) && input.catatan.trim().length < 10) {
    return input.ke === "hilang"
      ? "Sebutkan bagaimana hilangnya (minimal 10 huruf); tanpa itu jejaknya tidak menolong saat ditelusuri."
      : "Sebutkan alasan pelepasannya (minimal 10 huruf), supaya nilainya bisa dipertanggungjawabkan.";
  }

  return null;
}

/** Keadaan yang boleh dituju dari keadaan sekarang, termasuk pindah tangan. */
export function tujuanPerpindahan(dari: StatusAset): StatusAset[] {
  return dari === "dilepas" ? [] : [dari, ...LANJUTAN_ASET[dari]];
}

// ---------------------------------------------------------------------
// Jejak perubahan data aset
// ---------------------------------------------------------------------

export type JejakDataAset = {
  id: string;
  aksi: string;
  olehNama: string | null;
  pada: string;
  perubahan: PerubahanField[];
};

export type PerubahanField = {
  label: string;
  dari: string | number | null;
  ke: string | number | null;
  /** Nilai rupiah dirapikan berbeda dari teks biasa. */
  rupiah?: boolean;
};

/**
 * Kolom yang berarti dibaca orang, beserta namanya di layar.
 *
 * Id unit, pemegang, dan transaksi sengaja tidak ikut: perpindahan
 * pemegang sudah punya riwayatnya sendiri, dan menampilkan UUID di jejak
 * hanya membuat perubahan yang penting tenggelam di antara deretan angka
 * acak.
 */
const FIELD_JEJAK: { kunci: string; label: string; rupiah?: boolean }[] = [
  { kunci: "kode", label: "Kode" },
  { kunci: "nama", label: "Nama" },
  { kunci: "kategori", label: "Kategori" },
  { kunci: "tanggal", label: "Tanggal perolehan" },
  { kunci: "nilai_perolehan", label: "Nilai perolehan", rupiah: true },
  { kunci: "masa_manfaat", label: "Masa manfaat (bulan)" },
  { kunci: "residu", label: "Nilai residu", rupiah: true },
  { kunci: "status", label: "Keadaan" },
  { kunci: "berakhir", label: "Berhenti dimiliki" },
];

/** Perbedaan antara dua potret aset, hanya kolom yang benar-benar berubah. */
export function bandingkanJejak(
  lama: Record<string, unknown> | null,
  baru: Record<string, unknown> | null,
): PerubahanField[] {
  return FIELD_JEJAK.flatMap(({ kunci, label, rupiah }) => {
    const sebelum = lama?.[kunci] ?? null;
    const sesudah = baru?.[kunci] ?? null;
    if (String(sebelum) === String(sesudah)) return [];

    const nilai = (v: unknown): string | number | null => {
      if (v === null || v === undefined) return null;
      return rupiah ? Number(v) : String(v);
    };

    return [{ label, dari: nilai(sebelum), ke: nilai(sesudah), rupiah }];
  });
}

// ---------------------------------------------------------------------
// Log perubahan
// ---------------------------------------------------------------------

export type BarisLogAset = KejadianAset & {
  asetId: string;
  kode: string;
  namaAset: string;
  unitNama: string;
};

export type SaringanLogAset = {
  cari: string;
  status: StatusAset | "semua";
  unit: string;
  dari: string;
  sampai: string;
};

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export function bacaSaringanLogAset(params: {
  cari?: string | string[];
  status?: string | string[];
  unit?: string | string[];
  dari?: string | string[];
  sampai?: string | string[];
}): SaringanLogAset {
  const satu = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";

  const status = satu(params.status);
  const dari = satu(params.dari);
  const sampai = satu(params.sampai);

  return {
    cari: satu(params.cari).trim().slice(0, 60),
    status: STATUS_ASET.includes(status as StatusAset)
      ? (status as StatusAset)
      : "semua",
    unit: satu(params.unit) || "semua",
    dari: POLA_TANGGAL.test(dari) ? dari : "",
    sampai: POLA_TANGGAL.test(sampai) ? sampai : "",
  };
}

export function logAsetTersaring(s: SaringanLogAset) {
  return (
    s.cari !== "" ||
    s.status !== "semua" ||
    s.unit !== "semua" ||
    s.dari !== "" ||
    s.sampai !== ""
  );
}

/**
 * Pencarian log mencakup nama pemegang dan pencatatnya.
 *
 * Penelusuran barang hampir selalu dimulai dari nama orang — "terakhir
 * dipegang siapa" — bukan dari kode asetnya.
 */
export function saringLogAset(
  daftar: BarisLogAset[],
  s: SaringanLogAset,
): BarisLogAset[] {
  const kata = s.cari.toLowerCase();

  return daftar.filter((b) => {
    if (s.status !== "semua" && b.ke !== s.status) return false;
    if (s.unit !== "semua" && b.unitNama !== s.unit) return false;

    const hari = b.pada.slice(0, 10);
    if (s.dari && hari < s.dari) return false;
    if (s.sampai && hari > s.sampai) return false;

    if (kata === "") return true;
    return [
      b.kode,
      b.namaAset,
      b.pemegangNama ?? "",
      b.olehNama ?? "",
      b.lokasi,
      b.catatan,
    ].some((t) => t.toLowerCase().includes(kata));
  });
}

// ---------------------------------------------------------------------
// Penyaringan
// ---------------------------------------------------------------------

export type SaringanAset = {
  cari: string;
  status: StatusAset | "semua";
  unit: string;
  kategori: string;
};

export function bacaSaringanAset(params: {
  cari?: string | string[];
  status?: string | string[];
  unit?: string | string[];
  kategori?: string | string[];
}): SaringanAset {
  const satu = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";

  const status = satu(params.status);

  return {
    cari: satu(params.cari).trim().slice(0, 60),
    status: STATUS_ASET.includes(status as StatusAset)
      ? (status as StatusAset)
      : "semua",
    unit: satu(params.unit) || "semua",
    kategori: satu(params.kategori) || "semua",
  };
}

export function asetTersaring(s: SaringanAset) {
  return (
    s.cari !== "" ||
    s.status !== "semua" ||
    s.unit !== "semua" ||
    s.kategori !== "semua"
  );
}

/**
 * Pencarian mencakup kode, nama, kategori, pemegang, dan lokasi — orang
 * mencari dengan potongan yang ia ingat, dan yang paling sering diingat
 * justru "laptop yang dipegang siapa", bukan kodenya.
 */
export function saringAset(daftar: Aset[], s: SaringanAset): Aset[] {
  const kata = s.cari.toLowerCase();

  return daftar.filter((a) => {
    if (s.status !== "semua" && a.status !== s.status) return false;
    if (s.unit !== "semua" && a.unitNama !== s.unit) return false;
    if (s.kategori !== "semua" && a.kategori !== s.kategori) return false;

    if (kata === "") return true;
    return [a.kode, a.nama, a.kategori, a.pemegangNama ?? "", a.lokasi].some(
      (t) => t.toLowerCase().includes(kata),
    );
  });
}

/** Bentuk kode aset: AST-0001. */
export const POLA_KODE_ASET = /^AST-\d{4,}$/;

/** Nomor berikutnya dari deretan kode yang sudah ada. */
export function kodeAsetBerikutnya(kode: string[]): string {
  const angka = kode
    .filter((k) => POLA_KODE_ASET.test(k))
    .map((k) => Number(k.slice(4)));
  const berikut = angka.length === 0 ? 1 : Math.max(...angka) + 1;
  return `AST-${String(berikut).padStart(4, "0")}`;
}
