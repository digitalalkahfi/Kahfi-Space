import type { KodeUnit, SasaranLaporan } from "@/lib/types";

/**
 * Bentuk laporan harian per departemen (PRD Fase 1).
 *
 * Yang membedakan isian bukan jenis sasarannya (akun atau unit) melainkan
 * departemennya: Affiliator melapor angka turunan — komisi, jumlah upload,
 * dan CO sampel — sedangkan MCN & TAP cukup GMV dan catatan. Kunci yang
 * dipakai adalah kode unit karena itulah kolom yang benar-benar ada di
 * `accounts.unit_id` dan `daily_reports.unit_id`; satu unit = satu
 * departemen pelaporan.
 */
export type KolomLaporan =
  "gmv" | "komisi" | "jumlahUpload" | "coSampel" | "catatan";

export const KOLOM_PER_UNIT: Record<KodeUnit, readonly KolomLaporan[]> = {
  affiliator: ["gmv", "komisi", "jumlahUpload", "coSampel", "catatan"],
  mcn: ["gmv", "catatan"],
  tap: ["gmv", "catatan"],
};

/** Isian minimum saat unitnya belum diketahui — GMV tetap wajib. */
const KOLOM_DASAR: readonly KolomLaporan[] = ["gmv", "catatan"];

export function kolomLaporan(unit: KodeUnit | null): readonly KolomLaporan[] {
  return unit ? KOLOM_PER_UNIT[unit] : KOLOM_DASAR;
}

export function punyaKolom(unit: KodeUnit | null, kolom: KolomLaporan) {
  return kolomLaporan(unit).includes(kolom);
}

/** Departemen pelapor sebuah sasaran; akun mewarisi unit akunnya. */
export function unitSasaran(sasaran: SasaranLaporan): KodeUnit {
  return sasaran.jenis === "akun" ? sasaran.akun.unitId : sasaran.unitId;
}

export const LABEL_KOLOM: Record<KolomLaporan, string> = {
  gmv: "Nilai realisasi GMV",
  komisi: "Komisi diterima",
  jumlahUpload: "Jumlah upload",
  coSampel: "CO sampel",
  catatan: "Catatan harian",
};

// Batas atas mengikuti constraint di database; menahan salah ketik nol.
export const MAKS_GMV = 100_000_000_000;
export const MAKS_KOMISI = 10_000_000_000;
export const MAKS_UPLOAD = 500;

/**
 * Isi satu laporan harian. Kolom yang tidak berlaku bagi departemennya
 * bernilai `null` — bukan 0 — supaya "tidak dilaporkan" dan "dilaporkan
 * nol" tetap bisa dibedakan saat direkap.
 */
export type IsiLaporan = {
  gmv: number;
  komisi: number | null;
  jumlahUpload: number | null;
  catatan: string;
};

export const ISI_KOSONG: IsiLaporan = {
  gmv: 0,
  komisi: null,
  jumlahUpload: null,
  catatan: "",
};

/**
 * Buang kolom yang bukan milik departemen ini. Dipanggil sebelum kirim:
 * pelapor bisa saja mengisi komisi lalu berpindah ke sasaran MCN, dan
 * angka yang tertinggal di state tidak boleh ikut tersimpan.
 */
export function bersihkanIsi(
  unit: KodeUnit | null,
  isi: IsiLaporan,
): IsiLaporan {
  return {
    gmv: isi.gmv,
    komisi: punyaKolom(unit, "komisi") ? isi.komisi : null,
    jumlahUpload: punyaKolom(unit, "jumlahUpload") ? isi.jumlahUpload : null,
    catatan: isi.catatan.trim(),
  };
}

/**
 * Satu tempat pemeriksaan isi, dipakai form (untuk mengunci tombol) dan
 * Server Action (untuk menolak kiriman yang tidak lewat form). Mengembalikan
 * pesan pertama yang gagal, atau null bila isian sah.
 */
export function periksaIsiLaporan(
  unit: KodeUnit | null,
  isi: IsiLaporan,
): string | null {
  if (!Number.isFinite(isi.gmv) || isi.gmv < 0) return "Nilai GMV tidak sah.";
  if (isi.gmv === 0) return "GMV belum diisi.";
  if (isi.gmv > MAKS_GMV) return "Nilai GMV di luar batas wajar, periksa lagi.";

  if (isi.komisi !== null) {
    if (!punyaKolom(unit, "komisi")) {
      return "Komisi tidak diisi untuk departemen ini.";
    }
    if (!Number.isFinite(isi.komisi) || isi.komisi < 0) {
      return "Nilai komisi tidak sah.";
    }
    if (isi.komisi > MAKS_KOMISI) {
      return "Nilai komisi di luar batas wajar, periksa lagi.";
    }
    if (isi.komisi > isi.gmv) {
      return "Komisi tidak mungkin melebihi GMV, periksa lagi.";
    }
  }

  if (isi.jumlahUpload !== null) {
    if (!punyaKolom(unit, "jumlahUpload")) {
      return "Jumlah upload tidak diisi untuk departemen ini.";
    }
    if (!Number.isInteger(isi.jumlahUpload) || isi.jumlahUpload < 0) {
      return "Jumlah upload harus bilangan bulat.";
    }
    if (isi.jumlahUpload > MAKS_UPLOAD) {
      return "Jumlah upload di luar batas wajar, periksa lagi.";
    }
  }

  return null;
}

/** Satu angka yang berubah dalam sebuah perbaikan. */
export type PerubahanRevisi = {
  kolom: "gmv" | "komisi" | "jumlahUpload";
  dari: number;
  ke: number;
};

/**
 * Angka apa saja yang benar-benar berubah pada satu baris jejak.
 *
 * Jejak menyimpan GMV apa adanya (berubah atau tidak) supaya baris lama
 * tetap terbaca, sedangkan kolom departemen hanya terisi bila ikut
 * berubah. Layar tidak boleh menampilkan "Rp 5.000.000 → Rp 5.000.000"
 * seolah-olah itu perbaikan.
 */
export function perubahanRevisi(r: {
  gmvLama: number;
  gmvBaru: number;
  komisiLama: number | null;
  komisiBaru: number | null;
  uploadLama: number | null;
  uploadBaru: number | null;
}): PerubahanRevisi[] {
  const hasil: PerubahanRevisi[] = [];
  if (r.gmvLama !== r.gmvBaru) {
    hasil.push({ kolom: "gmv", dari: r.gmvLama, ke: r.gmvBaru });
  }
  if (r.komisiLama !== null || r.komisiBaru !== null) {
    hasil.push({
      kolom: "komisi",
      dari: r.komisiLama ?? 0,
      ke: r.komisiBaru ?? 0,
    });
  }
  if (r.uploadLama !== null || r.uploadBaru !== null) {
    hasil.push({
      kolom: "jumlahUpload",
      dari: r.uploadLama ?? 0,
      ke: r.uploadBaru ?? 0,
    });
  }
  return hasil;
}

/**
 * Siapa boleh melihat sebuah laporan harian.
 *
 * Cerminan policy `daily_reports_baca` (migrasi 0005) untuk mode demo,
 * yang tidak punya RLS. Tanpa ini Leader di mode demo hanya melihat
 * laporannya sendiri, padahal di mode Supabase ia melihat seluruh
 * unitnya — rekap Leader jadi kosong hanya saat dicoba.
 *
 * Rantai atasan tidak ikut dimodelkan di sini: data contoh menautkan
 * laporan ke nama pelapor, bukan ke pohon `atasan_id`.
 */
export function bolehLihatLaporan(
  pengguna: { role: string; nama: string; unitId: KodeUnit | null },
  laporan: {
    /** Nama pelapor. */
    pelapor: string;
    /** Unit sasaran, hanya terisi pada laporan tingkat unit. */
    unitLaporan: KodeUnit | null;
    /** Unit pelapor/akun — departemen laporan ini. */
    departemen: KodeUnit | null;
    /** Nama PIC akun yang dilaporkan, bila sasarannya akun. */
    picAkun: string | null;
  },
): boolean {
  if (["CEO", "Manager", "Finance"].includes(pengguna.role)) return true;
  if (laporan.pelapor === pengguna.nama) return true;
  if (laporan.picAkun === pengguna.nama) return true;

  const memimpin = pengguna.role === "Leader" || pengguna.role === "Co-Leader";
  if (!memimpin || !pengguna.unitId) return false;

  return (
    laporan.departemen === pengguna.unitId ||
    laporan.unitLaporan === pengguna.unitId
  );
}
