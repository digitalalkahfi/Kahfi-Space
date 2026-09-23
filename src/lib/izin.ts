/**
 * Izin berjam & izin terencana (PRD Fase 3) — aturan murni.
 *
 * Tiga bentuk pengajuan yang berbeda sifatnya, bukan tiga nama untuk hal
 * yang sama:
 *   - `sakit`   : hari berjalan, tidak bisa direncanakan;
 *   - `terencana`: sehari atau lebih, diajukan minimal H-1;
 *   - `jam`     : beberapa jam pada hari berjalan — orangnya tetap masuk,
 *                 hanya datang lebih lambat.
 */

export type BentukIzin = "sakit" | "terencana" | "jam";

export const LABEL_BENTUK: Record<
  BentukIzin,
  { label: string; keterangan: string }
> = {
  sakit: {
    label: "Sakit",
    keterangan: "Hari ini, tanpa perlu diajukan sebelumnya",
  },
  terencana: {
    label: "Izin terencana",
    keterangan: "Sehari atau lebih, diajukan minimal H-1",
  },
  jam: {
    label: "Izin beberapa jam",
    keterangan: "Hari ini, sebutkan jam mulai dan selesainya",
  },
};

export const MIN_ALASAN_IZIN = 5;
export const MAKS_ALASAN_IZIN = 300;
/** Batas wajar satu pengajuan terencana; menahan salah pilih tanggal. */
export const MAKS_HARI_IZIN = 30;

export type IsiIzin = {
  bentuk: BentukIzin;
  /** Hari pertama; untuk `sakit` dan `jam` selalu hari berjalan. */
  mulai: string;
  /** Hari terakhir, hanya untuk `terencana`. */
  selesai: string;
  /** Jam mulai & selesai izin, hanya untuk `jam`. Format HH:MM. */
  jamMulai: string;
  jamSelesai: string;
  alasan: string;
};

/** Tanggal paling awal yang boleh diajukan untuk izin terencana: H-1. */
export function batasTerencana(hariIni: string): string {
  const d = new Date(`${hariIni}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Banyaknya hari dalam satu rentang, termasuk kedua ujungnya. */
export function jumlahHari(mulai: string, selesai: string): number {
  const a = new Date(`${mulai}T00:00:00Z`).getTime();
  const b = new Date(`${selesai}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Semua tanggal dalam rentang, untuk membuat satu baris absensi per hari. */
export function tanggalRentang(mulai: string, selesai: string): string[] {
  const n = jumlahHari(mulai, selesai);
  const d = new Date(`${mulai}T00:00:00Z`);
  return Array.from({ length: n }, () => {
    const teks = d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
    return teks;
  });
}

function menitJam(jam: string): number | null {
  const cocok = /^(\d{2}):(\d{2})$/.exec(jam);
  if (!cocok) return null;
  const j = Number(cocok[1]);
  const m = Number(cocok[2]);
  if (j > 23 || m > 59) return null;
  return j * 60 + m;
}

/**
 * Pemeriksaan yang dipakai form dan Server Action. Mengembalikan pesan
 * pertama yang gagal, atau null bila pengajuannya sah.
 */
export function periksaIzin(isi: IsiIzin, hariIni: string): string | null {
  if (isi.alasan.trim().length < MIN_ALASAN_IZIN) {
    return `Tulis alasan minimal ${MIN_ALASAN_IZIN} karakter.`;
  }
  if (isi.alasan.length > MAKS_ALASAN_IZIN) {
    return "Alasan terlalu panjang.";
  }

  if (isi.bentuk === "jam") {
    if (isi.mulai !== hariIni) {
      return "Izin beberapa jam hanya untuk hari berjalan.";
    }
    const mulai = menitJam(isi.jamMulai);
    const selesai = menitJam(isi.jamSelesai);
    if (mulai === null || selesai === null) {
      return "Isi jam mulai dan jam selesai izin.";
    }
    if (selesai <= mulai) {
      return "Jam selesai harus setelah jam mulai.";
    }
    return null;
  }

  if (isi.bentuk === "sakit") {
    return isi.mulai === hariIni
      ? null
      : "Pengajuan sakit dicatat untuk hari berjalan.";
  }

  // Terencana.
  if (isi.mulai < batasTerencana(hariIni)) {
    return "Izin terencana diajukan paling lambat H-1.";
  }
  const hari = jumlahHari(isi.mulai, isi.selesai);
  if (hari === 0) return "Tanggal selesai tidak boleh sebelum tanggal mulai.";
  if (hari > MAKS_HARI_IZIN) {
    return `Satu pengajuan paling lama ${MAKS_HARI_IZIN} hari.`;
  }
  return null;
}

/**
 * Jam efektif masuk: yang lebih akhir antara batas jam kerja normal dan
 * jam selesai izin yang DISETUJUI. Izin yang belum disetujui tidak
 * menggeser apa pun — kalau tidak, orang bisa membatalkan telatnya
 * sendiri hanya dengan mengajukan izin.
 */
export function jamEfektifMasuk(
  batasNormal: string,
  izin: { jamSelesai: string | null; disetujui: boolean } | null,
): string {
  if (!izin?.disetujui || !izin.jamSelesai) return batasNormal;
  const normal = menitJam(batasNormal);
  const selesai = menitJam(izin.jamSelesai);
  if (normal === null || selesai === null) return batasNormal;
  return selesai > normal ? izin.jamSelesai : batasNormal;
}

/** Selisih menit keterlambatan terhadap jam efektif; 0 bila tidak telat. */
export function menitTelat(jamMasuk: string, jamEfektif: string): number {
  const masuk = menitJam(jamMasuk);
  const efektif = menitJam(jamEfektif);
  if (masuk === null || efektif === null) return 0;
  return Math.max(0, masuk - efektif);
}

/** Panjang minimal alasan penolakan; sejalan pagar di migrasi 0133. */
export const MIN_ALASAN_TOLAK = 10;
