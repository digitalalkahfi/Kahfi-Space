import type { Peran } from "@/lib/types";
import type {
  JenisIzinDb,
  StatusKehadiranDb,
  StatusPersetujuanDb,
} from "@/lib/supabase/types";

/**
 * Rekap kehadiran per orang.
 *
 * Rekap lama hanya membaca baris absensi yang ada, sehingga orang yang
 * tidak absen sama sekali justru tidak pernah muncul — padahal dialah
 * yang paling perlu terlihat. Modul ini melengkapi hari kerja yang
 * kosong dan menjumlahkannya per orang. Padanan SQL-nya
 * `rekap_kehadiran_orang` (migrasi 0170); aturannya harus sama persis.
 */

/** Leader ke bawah wajib absen; CEO, Manager, dan Finance tidak. */
export const PERAN_WAJIB_ABSEN: readonly Peran[] = [
  "Leader",
  "Co-Leader",
  "Staff",
];

export function wajibAbsen(peran: Peran): boolean {
  return PERAN_WAJIB_ABSEN.includes(peran);
}

/** Hari kerja: Senin–Sabtu, di luar libur perusahaan di kalender. */
export function hariKerja(
  tanggal: string,
  libur: ReadonlySet<string> = new Set(),
): boolean {
  const d = new Date(`${tanggal}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCDay() !== 0 && !libur.has(tanggal);
}

/** Seluruh hari kerja dalam rentang, urut naik. */
export function daftarHariKerja(
  dari: string,
  sampai: string,
  libur: ReadonlySet<string> = new Set(),
): string[] {
  const hasil: string[] = [];
  const d = new Date(`${dari}T00:00:00Z`);
  const akhir = new Date(`${sampai}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(akhir.getTime())) return hasil;
  while (d <= akhir) {
    const iso = d.toISOString().slice(0, 10);
    if (hariKerja(iso, libur)) hasil.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return hasil;
}

export type StatusHari =
  "hadir" | "terlambat" | "izin" | "sakit" | "tanpa_keterangan" | "belum_absen";

export const LABEL_STATUS_HARI: Record<StatusHari, string> = {
  hadir: "Hadir",
  terlambat: "Terlambat",
  izin: "Izin",
  sakit: "Sakit",
  tanpa_keterangan: "Tanpa keterangan",
  belum_absen: "Belum absen",
};

export const GAYA_STATUS_HARI: Record<StatusHari, string> = {
  hadir: "bg-ok-fill text-ok-text",
  terlambat: "bg-warn-fill text-warn-text",
  izin: "bg-info-fill text-info-text",
  sakit: "bg-info-fill text-info-text",
  tanpa_keterangan: "bg-danger-fill text-danger-text",
  belum_absen: "bg-muted text-muted-foreground",
};

/** Satu orang pada satu hari, sebagaimana dikembalikan basis data. */
export type BarisKehadiranOrang = {
  userId: string;
  nama: string;
  unit: string;
  role: Peran;
  wajibAbsen: boolean;
  tanggal: string;
  /** null = tidak ada catatan absensi hari itu. */
  status: StatusKehadiranDb | null;
  jamMasuk: string | null;
  jamPulang: string | null;
  menitTelat: number;
  izinJenis: JenisIzinDb | null;
  izinSelesai: string | null;
  lokasiValid: boolean;
  alasan: string;
  persetujuan: StatusPersetujuanDb | null;
};

export type HariKehadiranOrang = {
  tanggal: string;
  status: StatusHari;
  jamMasuk: string | null;
  jamPulang: string | null;
  menitTelat: number;
  /** Jam selesai izin berjam yang disetujui; orangnya tetap masuk hari itu. */
  izinSelesai: string | null;
  lokasiValid: boolean;
  alasan: string;
  persetujuan: StatusPersetujuanDb | null;
};

/**
 * Status satu hari dari sudut pandang rekap.
 *
 * Tanpa catatan pada hari yang sudah lewat berarti tanpa keterangan;
 * pada hari ini berarti belum absen — harinya belum selesai. Izin atau
 * sakit yang ditolak atasan dihitung tanpa keterangan: penolakan itu
 * justru keputusan bahwa ketidakhadirannya tidak diterima.
 */
export function statusHari(
  b: Pick<BarisKehadiranOrang, "status" | "persetujuan" | "tanggal">,
  hariIni: string,
): StatusHari {
  if (b.status === null || b.status === "alpa") {
    return b.tanggal === hariIni ? "belum_absen" : "tanpa_keterangan";
  }
  if (b.status === "izin" || b.status === "sakit") {
    return b.persetujuan === "ditolak" ? "tanpa_keterangan" : b.status;
  }
  return b.status;
}

export type JumlahKehadiran = {
  /** Hari yang dinilai: seluruh hari kecuali hari ini yang belum diisi. */
  hariKerja: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  tanpaKeterangan: number;
  belumAbsen: number;
};

export type RekapOrang = {
  id: string;
  nama: string;
  unit: string;
  role: Peran;
  wajibAbsen: boolean;
  /** Hari demi hari, terbaru dulu. */
  hari: HariKehadiranOrang[];
  jumlah: JumlahKehadiran;
  /**
   * Persen hari masuk (hadir + terlambat) terhadap hari yang seharusnya
   * masuk (hadir + terlambat + tanpa keterangan). Izin dan sakit tidak
   * masuk pembagi — menghitungnya berarti menghukum orang karena izin
   * yang sudah disetujui atasannya sendiri. null bila belum ada hari
   * yang dinilai.
   */
  persenHadir: number | null;
  totalMenitTelat: number;
};

const JUMLAH_KOSONG: JumlahKehadiran = {
  hariKerja: 0,
  hadir: 0,
  terlambat: 0,
  izin: 0,
  sakit: 0,
  tanpaKeterangan: 0,
  belumAbsen: 0,
};

function hitungJumlah(hari: readonly HariKehadiranOrang[]): JumlahKehadiran {
  const n = (s: StatusHari) => hari.filter((h) => h.status === s).length;
  const belumAbsen = n("belum_absen");
  return {
    hariKerja: hari.length - belumAbsen,
    hadir: n("hadir"),
    terlambat: n("terlambat"),
    izin: n("izin"),
    sakit: n("sakit"),
    tanpaKeterangan: n("tanpa_keterangan"),
    belumAbsen,
  };
}

export function persenHadirDari(j: JumlahKehadiran): number | null {
  const masuk = j.hadir + j.terlambat;
  const pembagi = masuk + j.tanpaKeterangan;
  return pembagi === 0 ? null : (masuk / pembagi) * 100;
}

/** Kelompokkan baris per orang, urut nama; harinya urut terbaru dulu. */
export function susunRekapOrang(
  baris: readonly BarisKehadiranOrang[],
  hariIni: string,
): RekapOrang[] {
  const peta = new Map<string, RekapOrang>();

  for (const b of baris) {
    let o = peta.get(b.userId);
    if (!o) {
      o = {
        id: b.userId,
        nama: b.nama,
        unit: b.unit,
        role: b.role,
        wajibAbsen: b.wajibAbsen,
        hari: [],
        jumlah: { ...JUMLAH_KOSONG },
        persenHadir: null,
        totalMenitTelat: 0,
      };
      peta.set(b.userId, o);
    }
    o.hari.push({
      tanggal: b.tanggal,
      status: statusHari(b, hariIni),
      jamMasuk: b.jamMasuk,
      jamPulang: b.jamPulang,
      menitTelat: b.menitTelat,
      izinSelesai:
        b.izinJenis === "jam" && b.persetujuan === "disetujui"
          ? b.izinSelesai
          : null,
      lokasiValid: b.lokasiValid,
      alasan: b.alasan,
      persetujuan: b.persetujuan,
    });
  }

  const hasil = [...peta.values()];
  for (const o of hasil) {
    o.hari.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    o.jumlah = hitungJumlah(o.hari);
    o.persenHadir = persenHadirDari(o.jumlah);
    o.totalMenitTelat = o.hari.reduce((a, h) => a + h.menitTelat, 0);
  }

  return hasil.sort((a, b) => a.nama.localeCompare(b.nama));
}

export type RingkasRekapOrang = {
  orang: number;
  wajib: number;
  hariKerja: number;
  /** Hari masuk: hadir + terlambat. */
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  tanpaKeterangan: number;
  /** Rata-rata persen hadir orang yang wajib absen; null bila tidak ada. */
  rataHadir: number | null;
};

export function ringkasRekapOrang(
  daftar: readonly RekapOrang[],
): RingkasRekapOrang {
  const wajib = daftar.filter((o) => o.wajibAbsen);
  const jumlah = (ambil: (j: JumlahKehadiran) => number) =>
    daftar.reduce((a, o) => a + ambil(o.jumlah), 0);
  const dinilai = wajib.filter((o) => o.persenHadir !== null);

  return {
    orang: daftar.length,
    wajib: wajib.length,
    hariKerja: jumlah((j) => j.hariKerja),
    hadir: jumlah((j) => j.hadir + j.terlambat),
    terlambat: jumlah((j) => j.terlambat),
    izin: jumlah((j) => j.izin),
    sakit: jumlah((j) => j.sakit),
    tanpaKeterangan: jumlah((j) => j.tanpaKeterangan),
    rataHadir:
      dinilai.length === 0
        ? null
        : dinilai.reduce((a, o) => a + (o.persenHadir ?? 0), 0) /
          dinilai.length,
  };
}

/**
 * Urutan tampil: yang wajib absen dulu, yang paling banyak tanpa
 * keterangan di atas, lalu nama — yang perlu ditindaklanjuti terlihat
 * lebih dahulu.
 */
export function urutkanRekapOrang(daftar: readonly RekapOrang[]): RekapOrang[] {
  return [...daftar].sort(
    (a, b) =>
      Number(b.wajibAbsen) - Number(a.wajibAbsen) ||
      b.jumlah.tanpaKeterangan - a.jumlah.tanpaKeterangan ||
      a.nama.localeCompare(b.nama),
  );
}
