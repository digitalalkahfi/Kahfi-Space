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
  | "gmv"
  | "komisi"
  | "jumlahUpload"
  | "gmvLive"
  | "jamLive"
  | "coSampel"
  | "catatan";

export const KOLOM_PER_UNIT: Record<KodeUnit, readonly KolomLaporan[]> = {
  // GMV LIVE dan jam LIVE (0188, 0191): GRD memisahkan target LIVE dari
  // target video, dan menilai "LIVE 4 jam setiap hari".
  affiliator: [
    "gmv",
    "komisi",
    "jumlahUpload",
    "gmvLive",
    "jamLive",
    "coSampel",
    "catatan",
  ],
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
/** Kunci sebuah sasaran laporan: "akun:<uuid>" atau "unit:<kode>". */
export function kunciSasaranLaporan(s: SasaranLaporan): string {
  return s.jenis === "akun" ? `akun:${s.akun.id}` : `unit:${s.unitId}`;
}

/**
 * Sasaran yang belum dilapor pada hari itu, urut seperti daftarnya.
 *
 * Dihitung per SASARAN, bukan per orang: PIC yang memegang dua akun
 * masih punya satu sasaran tersisa setelah akun pertamanya dilapor.
 * Menyamakan keduanya pernah membuat form tertutup setelah laporan
 * pertama, sehingga akun kedua tidak bisa dilapor sama sekali.
 */
export function sasaranBelumDilapor(
  sasaran: readonly SasaranLaporan[],
  terlapor: readonly string[],
): SasaranLaporan[] {
  return sasaran.filter((s) => !terlapor.includes(kunciSasaranLaporan(s)));
}

export function unitSasaran(sasaran: SasaranLaporan): KodeUnit {
  return sasaran.jenis === "akun" ? sasaran.akun.unitId : sasaran.unitId;
}

export const LABEL_KOLOM: Record<KolomLaporan, string> = {
  gmv: "Nilai realisasi GMV",
  komisi: "Komisi diterima",
  jumlahUpload: "Jumlah upload",
  gmvLive: "GMV dari LIVE",
  jamLive: "Lama LIVE (jam)",
  coSampel: "CO sampel",
  catatan: "Catatan harian",
};

// Batas atas mengikuti constraint di database; menahan salah ketik nol.
export const MAKS_GMV = 100_000_000_000;
export const MAKS_KOMISI = 10_000_000_000;
export const MAKS_UPLOAD = 500;
export const MAKS_JAM_LIVE = 24;

/**
 * Isi satu laporan harian. Kolom yang tidak berlaku bagi departemennya
 * bernilai `null` — bukan 0 — supaya "tidak dilaporkan" dan "dilaporkan
 * nol" tetap bisa dibedakan saat direkap.
 */
export type IsiLaporan = {
  gmv: number;
  komisi: number | null;
  jumlahUpload: number | null;
  /** Bagian GMV dari LIVE; null bila hari itu tidak LIVE. */
  gmvLive?: number | null;
  /** Lama LIVE dalam jam; null bila hari itu tidak LIVE. */
  jamLive?: number | null;
  catatan: string;
};

export const ISI_KOSONG: IsiLaporan = {
  gmv: 0,
  komisi: null,
  jumlahUpload: null,
  gmvLive: null,
  jamLive: null,
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
    gmvLive: punyaKolom(unit, "gmvLive") ? (isi.gmvLive ?? null) : null,
    jamLive: punyaKolom(unit, "jamLive") ? (isi.jamLive ?? null) : null,
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

  const gmvLive = isi.gmvLive ?? null;
  if (gmvLive !== null) {
    if (!punyaKolom(unit, "gmvLive")) {
      return "GMV LIVE tidak diisi untuk departemen ini.";
    }
    if (!Number.isFinite(gmvLive) || gmvLive < 0) {
      return "Nilai GMV LIVE tidak sah.";
    }
    if (gmvLive > isi.gmv) {
      return "GMV LIVE adalah bagian dari GMV hari itu, tidak mungkin lebih besar.";
    }
  }

  const jamLive = isi.jamLive ?? null;
  if (jamLive !== null) {
    if (!punyaKolom(unit, "jamLive")) {
      return "Jam LIVE tidak diisi untuk departemen ini.";
    }
    if (!Number.isFinite(jamLive) || jamLive < 0 || jamLive > MAKS_JAM_LIVE) {
      return "Lama LIVE harus antara 0 dan 24 jam.";
    }
  }

  return null;
}

/** Satu angka yang berubah dalam sebuah perbaikan. */
export type PerubahanRevisi = {
  kolom: "gmv" | "komisi" | "jumlahUpload" | "gmvLive" | "jamLive";
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
  liveLama?: number | null;
  liveBaru?: number | null;
  jamLama?: number | null;
  jamBaru?: number | null;
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
  if ((r.liveLama ?? null) !== null || (r.liveBaru ?? null) !== null) {
    hasil.push({
      kolom: "gmvLive",
      dari: r.liveLama ?? 0,
      ke: r.liveBaru ?? 0,
    });
  }
  if ((r.jamLama ?? null) !== null || (r.jamBaru ?? null) !== null) {
    hasil.push({ kolom: "jamLive", dari: r.jamLama ?? 0, ke: r.jamBaru ?? 0 });
  }
  return hasil;
}

/**
 * Siapa boleh melihat sebuah laporan harian.
 *
 * Cerminan policy `daily_reports_baca` (migrasi 0173) untuk mode demo,
 * yang tidak punya RLS: pelapor dan PIC akunnya sendiri, orang-orang di
 * bawahnya lewat garis pelaporan (`terlihat`), dan laporan tingkat unit
 * bagi anggota unit itu. Rekan seunit yang bukan bawahannya tidak
 * termasuk — itulah beda hierarki dengan aturan per unit yang lama.
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
  /** Nama orang-orang di bawah pengguna; kosong berarti tidak punya bawahan. */
  terlihat: ReadonlySet<string> = new Set(),
): boolean {
  if (["CEO", "Manager", "Finance"].includes(pengguna.role)) return true;
  if (laporan.pelapor === pengguna.nama) return true;
  if (laporan.picAkun === pengguna.nama) return true;
  if (terlihat.has(laporan.pelapor)) return true;
  if (laporan.picAkun !== null && terlihat.has(laporan.picAkun)) return true;

  // Laporan tingkat unit (MCN/TAP) adalah konteks bersama unit itu.
  return (
    laporan.unitLaporan !== null && laporan.unitLaporan === pengguna.unitId
  );
}

// ---------------------------------------------------------------------
// Tanggal laporan dan laporan susulan
//
// Pelapor memilih tanggal laporannya dari kalender. Tanggal merah berarti
// masih ada sasaran yang belum dilapor pada hari itu, hijau berarti semua
// sudah; tanggal merah yang lewat bisa diisi menyusul — mis. karena
// pelapornya sakit. Sebuah sasaran baru ditagih sejak ia terdaftar di
// K-Space, jadi riwayat sebelum itu tidak berubah menjadi merah semua.
//
// GMV dihitung untuk satu hari penuh (24 jam), jadi hari ini belum bisa
// dilapor: laporan yang dikirim pada tanggal 6 memuat GMV tanggal 5 dan
// disimpan bertanggal 5 (H-1). Tanggal laporan = tanggal GMV-nya, sehingga
// KPI, GRD, dan grafik membaca angka itu di harinya sendiri. Database
// menolak tanggal hari ini dan masa depan (0207) serta laporan ganda per
// sasaran per tanggal.
// ---------------------------------------------------------------------

/** Geser tanggal "YYYY-MM-DD" sebanyak `n` hari, bebas zona waktu. */
export function geserHari(tanggal: string, n: number): string {
  const [t, b, h] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(t, b - 1, h + n)).toISOString().slice(0, 10);
}

/**
 * Tanggal terbaru yang boleh dilapor: kemarin. GMV baru lengkap setelah
 * hari itu berakhir, jadi hari ini tidak bisa dilaporkan sampai besok.
 * Satu-satunya tempat aturan H-1 ditulis di sisi aplikasi; semua layar
 * yang butuh "tanggal laporan yang jatuh tempo hari ini" memanggilnya.
 */
export function tanggalDataTerakhir(hariIni: string): string {
  return geserHari(hariIni, -1);
}

/** Pesan baku saat laporan diminta untuk hari ini (belum satu hari penuh). */
export const PESAN_GMV_BELUM_PENUH =
  "GMV dihitung satu hari penuh (24 jam), jadi laporan hari ini baru bisa dikirim besok. Kirim laporan untuk kemarin.";

/**
 * "dikirim 6 Okt, 08:12" (WIB). Tanggal sebuah laporan adalah tanggal GMV-nya
 * (kemarin), bukan hari ia dikirim, jadi riwayat menyebut keduanya.
 */
export function keteranganDikirim(dikirim: string): string {
  const d = new Date(dikirim);
  const tanggal = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  });
  const jam = d
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    })
    .replace(".", ":");
  return `dikirim ${tanggal}, ${jam}`;
}

/** Tanggal "YYYY-MM-DD" yang benar-benar ada di kalender. */
function tanggalAda(tanggal: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(tanggal) && geserHari(tanggal, 0) === tanggal
  );
}

/**
 * Alasan sebuah tanggal tidak bisa dilapor, atau null bila boleh.
 * `mulai` = tanggal sasarannya terdaftar di K-Space.
 */
export function alasanTanggalLaporan(
  tanggal: string,
  hariIni: string,
  mulai: string | null = null,
): string | null {
  if (!tanggalAda(tanggal)) return "Tanggal laporan tidak sah.";
  if (tanggal > hariIni) return "Laporan tidak bisa bertanggal masa depan.";
  if (tanggal === hariIni) return PESAN_GMV_BELUM_PENUH;
  if (mulai && tanggal < mulai) {
    return `Sasaran ini baru terdaftar di K-Space sejak ${tanggalLaporanPanjang(mulai)}; laporan sebelum tanggal itu tidak bisa dikirim.`;
  }
  return null;
}

/** Tanggal yang boleh dilapor: kemarin, atau susulan sejak sasaran terdaftar. */
export function tanggalBolehLapor(
  tanggal: string,
  hariIni: string,
  mulai: string | null = null,
): boolean {
  return alasanTanggalLaporan(tanggal, hariIni, mulai) === null;
}

/** Keadaan laporan satu tanggal untuk sasaran-sasaran seseorang. */
export type StatusHariLaporan = {
  /** Banyaknya sasaran yang wajib dilapor pada tanggal itu. */
  wajib: number;
  /** Yang belum dilapor; 0 berarti hijau, selebihnya merah. */
  belum: number;
};

/** Isi kalender tanggal laporan untuk satu bulan. */
export type KalenderLaporan = {
  /** Bulan yang ditampilkan, "YYYY-MM-01". */
  bulan: string;
  /** Tanggal paling awal yang bisa dipilih: sasaran pertama terdaftar. */
  mulai: string;
  /** Status tiap tanggal; tanggal yang tidak ada berarti tanpa warna. */
  status: Record<string, StatusHariLaporan>;
};

/**
 * Status laporan tiap tanggal dalam satu bulan, sampai kemarin.
 * Tanggal tanpa sasaran wajib — sebelum sasaran pertama terdaftar, hari
 * ini (GMV-nya belum satu hari penuh), atau masa depan — tidak ikut, dan
 * di kalender tampil tanpa warna.
 */
export function statusLaporanBulan(
  bulan: string,
  kunciSasaran: readonly string[],
  terlapor: readonly { tanggal: string; kunci: string }[],
  hariIni: string,
  mulaiBerlaku: Readonly<Record<string, string>> = {},
): Record<string, StatusHariLaporan> {
  const sudah = new Set(terlapor.map((t) => `${t.tanggal}|${t.kunci}`));
  const hasil: Record<string, StatusHariLaporan> = {};
  const awal = `${bulan.slice(0, 7)}-01`;
  const akhir = tanggalDataTerakhir(hariIni);
  for (
    let tanggal = awal;
    tanggal.slice(0, 7) === awal.slice(0, 7) && tanggal <= akhir;
    tanggal = geserHari(tanggal, 1)
  ) {
    const wajib = kunciSasaran.filter(
      (k) => !(mulaiBerlaku[k] && mulaiBerlaku[k] > tanggal),
    );
    if (wajib.length === 0) continue;
    hasil[tanggal] = {
      wajib: wajib.length,
      belum: wajib.filter((k) => !sudah.has(`${tanggal}|${k}`)).length,
    };
  }
  return hasil;
}

/** "Sab, 26 Sep" — dibaca dalam UTC agar tanggalnya tidak bergeser. */
export function tanggalLaporanSingkat(tanggal: string): string {
  return new Date(`${tanggal}T00:00:00Z`).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Label pilihan tanggal: "Kemarin" (laporan biasa) atau "Sab, 26 Sep". */
export function labelHariLaporan(tanggal: string, hariIni: string): string {
  if (tanggal === tanggalDataTerakhir(hariIni)) return "Kemarin";
  return tanggalLaporanSingkat(tanggal);
}

/**
 * Keterangan waktu di dalam kalimat form: "kemarin" untuk laporan biasa,
 * "pada Sab, 26 Sep" untuk susulan — mis. "salin angka GMV pada Sab, 26 Sep".
 */
export function kapanLaporan(tanggal: string, hariIni: string): string {
  return tanggal === tanggalDataTerakhir(hariIni)
    ? "kemarin"
    : `pada ${tanggalLaporanSingkat(tanggal)}`;
}

/** "Sabtu, 26 September 2026" — dibaca dalam UTC agar tanggalnya tidak bergeser. */
export function tanggalLaporanPanjang(tanggal: string): string {
  return new Date(`${tanggal}T00:00:00Z`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
