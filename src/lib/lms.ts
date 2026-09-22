/**
 * LMS — tipe & perhitungan murni.
 */
import type { KodeUnit, Peran } from "@/lib/types";

export type TingkatKursus = "dasar" | "menengah" | "lanjutan";

export type ModulKursus = {
  id: string;
  urutan: number;
  judul: string;
  isi: string;
  durasiMenit: number;
  tuntas: boolean;
};

export type Kursus = {
  id: string;
  judul: string;
  ringkasan: string;
  kategori: string;
  tingkat: TingkatKursus;
  unitKode: KodeUnit | null;
  unitNama: string;
  wajibUntuk: Peran[];
  /** Kursus nonaktif tetap terbaca pengelola supaya bisa dihidupkan lagi. */
  aktif: boolean;
  modul: ModulKursus[];
  /** null bila pengguna belum mendaftar. */
  terdaftar: boolean;
  selesaiPada: string | null;
};

export const LABEL_TINGKAT: Record<TingkatKursus, string> = {
  dasar: "Dasar",
  menengah: "Menengah",
  lanjutan: "Lanjutan",
};

export const GAYA_TINGKAT: Record<TingkatKursus, string> = {
  dasar: "bg-ok-fill text-ok-text",
  menengah: "bg-info-fill text-info-text",
  lanjutan: "bg-accentmuted-fill text-accentmuted-text",
};

export function totalMenit(kursus: Kursus) {
  return kursus.modul.reduce((a, m) => a + m.durasiMenit, 0);
}

export function jumlahTuntas(kursus: Kursus) {
  return kursus.modul.filter((m) => m.tuntas).length;
}

/**
 * Kemajuan selalu dihitung dari modul yang tuntas, tidak pernah disimpan
 * sebagai angka tersendiri — angka yang disimpan terpisah cepat berbeda
 * dari isinya, dan yang salah biasanya justru angkanya.
 */
export function persenKemajuan(kursus: Kursus) {
  if (kursus.modul.length === 0) return 0;
  return Math.round((jumlahTuntas(kursus) / kursus.modul.length) * 100);
}

/**
 * Kursus yang diwajibkan bagi sebuah peran.
 *
 * Kursus yang sudah dipensiunkan tidak lagi mewajibkan siapa pun: kalau
 * tetap dihitung, seluruh tim akan selamanya tampil punya pelatihan wajib
 * yang tertunda padahal materinya memang sudah ditarik.
 */
export function wajibBagi(kursus: Kursus, peran: Peran) {
  return kursus.aktif && kursus.wajibUntuk.includes(peran);
}

/** Modul berikutnya yang belum tuntas, atau null bila semuanya sudah. */
export function modulBerikutnya(kursus: Kursus): ModulKursus | null {
  return (
    [...kursus.modul]
      .sort((a, b) => a.urutan - b.urutan)
      .find((m) => !m.tuntas) ?? null
  );
}

export type RingkasBelajar = {
  wajib: number;
  wajibSelesai: number;
  berjalan: number;
  selesai: number;
};

/**
 * Ringkasan yang menjawab pertanyaan sebenarnya: pelatihan wajib mana
 * yang belum tuntas. Jumlah kursus yang tersedia tidak menolong siapa
 * pun.
 */
export function ringkasBelajar(
  daftar: Kursus[],
  peran: Peran,
): RingkasBelajar {
  const wajib = daftar.filter((k) => wajibBagi(k, peran));

  return {
    wajib: wajib.length,
    wajibSelesai: wajib.filter((k) => k.selesaiPada !== null).length,
    berjalan: daftar.filter(
      (k) => k.terdaftar && k.selesaiPada === null,
    ).length,
    selesai: daftar.filter((k) => k.selesaiPada !== null).length,
  };
}

// ---------------------------------------------------------------------
// Kuis
// ---------------------------------------------------------------------

export type SoalKuis = {
  id: string;
  urutan: number;
  pertanyaan: string;
  /** Kunci jawabannya tidak pernah ikut; penilaian dikerjakan server. */
  pilihan: string[];
};

export type PercobaanKuis = {
  id: string;
  skor: number;
  lulus: boolean;
  dikerjakanPada: string;
};

export type HasilKuis = {
  skor: number;
  lulus: boolean;
  benar: number;
  total: number;
};

/** Sama dengan `ambang_lulus_kuis()` di database. */
export const AMBANG_LULUS_KUIS = 80;

/** Percobaan terbaik seseorang; itulah yang menentukan kelulusannya. */
export function percobaanTerbaik(
  daftar: PercobaanKuis[],
): PercobaanKuis | null {
  if (daftar.length === 0) return null;
  return [...daftar].sort((a, b) => b.skor - a.skor)[0];
}

/**
 * Berapa soal yang harus benar agar lulus.
 * Ditampilkan sebelum mengerjakan supaya tidak ada kejutan di akhir.
 */
export function minimalBenar(jumlahSoal: number) {
  return Math.ceil((AMBANG_LULUS_KUIS / 100) * jumlahSoal);
}

/** Soal beserta kuncinya — hanya untuk pengelola kursus. */
export type SoalDenganKunci = SoalKuis & {
  jawabanBenar: number;
  penjelasan: string;
};

// ---------------------------------------------------------------------
// Progres belajar tim
// ---------------------------------------------------------------------

export type ProgresOrang = {
  userId: string;
  nama: string;
  inisial: string;
  jabatan: string;
  unitNama: string;
  peran: Peran;
  /** Kursus yang diwajibkan bagi perannya. */
  wajib: number;
  wajibSelesai: number;
  /** Kursus wajib yang belum tuntas, untuk disebut namanya. */
  wajibTertunda: string[];
  berjalan: number;
  selesai: number;
};

/** Terlihat lebih dulu yang paling banyak tertinggal. */
export function urutkanProgres(daftar: ProgresOrang[]): ProgresOrang[] {
  return [...daftar].sort(
    (a, b) =>
      b.wajibTertunda.length - a.wajibTertunda.length ||
      a.nama.localeCompare(b.nama),
  );
}

export type RingkasProgresTim = {
  orang: number;
  tuntasSemua: number;
  tertinggal: number;
  belumMulai: number;
};

/**
 * Yang perlu ditindaklanjuti bukan rata-rata, melainkan siapa yang belum
 * menyentuh pelatihan wajibnya sama sekali — mereka yang paling mungkin
 * tidak tahu bahwa ada kewajiban itu.
 */
export function ringkasProgresTim(daftar: ProgresOrang[]): RingkasProgresTim {
  const berwajib = daftar.filter((o) => o.wajib > 0);

  return {
    orang: daftar.length,
    tuntasSemua: berwajib.filter((o) => o.wajibTertunda.length === 0).length,
    tertinggal: berwajib.filter((o) => o.wajibTertunda.length > 0).length,
    belumMulai: berwajib.filter(
      (o) => o.wajibSelesai === 0 && o.berjalan === 0,
    ).length,
  };
}

export type SaringanProgres = {
  cari: string;
  unit: string;
  /** Hanya yang pelatihan wajibnya belum tuntas — itulah daftar tindak lanjut. */
  hanyaTertinggal: boolean;
};

export const SARINGAN_PROGRES_KOSONG: SaringanProgres = {
  cari: "",
  unit: "semua",
  hanyaTertinggal: false,
};

/** Membaca saringan progres dari parameter URL. */
export function bacaSaringanProgres(params: {
  cari?: string | string[];
  unit?: string | string[];
  tertinggal?: string | string[];
}): SaringanProgres {
  const satu = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";

  return {
    cari: satu(params.cari).trim().slice(0, 60),
    unit: satu(params.unit) || "semua",
    hanyaTertinggal: satu(params.tertinggal) === "ya",
  };
}

export function progresTersaring(s: SaringanProgres) {
  return s.cari !== "" || s.unit !== "semua" || s.hanyaTertinggal;
}

/**
 * Menyaring daftar progres belajar.
 *
 * Pencarian ikut menjangkau nama pelatihan yang tertunda: pengelola
 * sering mencari "siapa saja yang belum ikut Onboarding", bukan mencari
 * orangnya satu per satu.
 */
export function saringProgres(
  daftar: ProgresOrang[],
  s: SaringanProgres,
): ProgresOrang[] {
  const kata = s.cari.toLowerCase();

  return daftar.filter((p) => {
    if (s.unit !== "semua" && p.unitNama !== s.unit) return false;
    if (s.hanyaTertinggal && p.wajibSelesai >= p.wajib) return false;

    if (kata === "") return true;
    return [p.nama, p.jabatan, p.unitNama, ...p.wajibTertunda].some((t) =>
      t.toLowerCase().includes(kata),
    );
  });
}
