/**
 * Papan tugas per tanggal (keputusan D4) — modul murni.
 *
 * Basis data yang memilih baris mana yang masuk papan sebuah tanggal
 * (`papan_tugas`, migrasi 0182); modul ini menyusunnya ke kolom dan
 * menandai yang terlambat. Aturan pemilihnya ditulis sekali lagi di sini
 * (`masukPapan`) hanya untuk mode demo, yang tidak punya basis data —
 * dan diuji supaya keduanya tidak berselisih.
 *
 * Isi kolom:
 *   · To Do / Sedang Dikerjakan / Review — status sesuai DAN tanggal
 *     tenggatnya (WIB) sama dengan tanggal terpilih;
 *   · khusus hari ini — yang belum selesai dan tenggatnya sudah lewat
 *     ikut tampil paling atas bertanda "Terlambat", begitu pula tiket
 *     lama tanpa tenggat ("Tanpa deadline");
 *   · Selesai — yang diselesaikan (`selesai_at`, WIB) pada tanggal itu.
 *
 * Papan "Semua" (bawaan halaman): SEMUA yang belum selesai dari tanggal
 * mana pun, urut dari deadline terdekat — tenggat adalah batas selesai,
 * bukan hari mengerjakan, jadi pekerjaan bertenggat pekan depan sudah
 * harus terlihat hari ini. Kolom Selesai berisi yang beres 7 hari
 * terakhir.
 */
import { keTanggalWib } from "@/lib/format";
import { geserTanggal, tanggalSah } from "@/lib/validasi-tugas";
import type { Prioritas, StatusTugas } from "@/lib/types";

/** Batas aman kartu per papan; sama dengan bawaan `papan_tugas` (0182). */
export const BATAS_PAPAN = 300;

/** Batas aman daftar bertenggat; sama dengan bawaan `daftar_tugas` (0182). */
export const BATAS_DAFTAR = 300;

/** Pilihan papan untuk semua tanggal sekaligus. */
export const SEMUA = "semua";

/** Nilai `?tanggal=` untuk hari ini — tautannya tetap berarti "hari ini" besok. */
export const PARAM_HARI_INI = "hari-ini";

/** Kolom Selesai papan Semua: yang beres selama sekian hari terakhir (WIB). */
export const HARI_SELESAI_SEMUA = 7;

/** Batas aman kartu Selesai di papan Semua. */
export const BATAS_SELESAI_SEMUA = 100;

/** Bagian tugas yang dibutuhkan untuk menyusun papan. */
export type TugasPapan = {
  /** Status kolom; `revisi` sudah dibaca sebagai `berjalan`. */
  status: StatusTugas;
  /** Status apa adanya; `dibatalkan` tidak pernah masuk papan. */
  statusAsli?: string;
  /** "" = tanpa tenggat (hanya tiket lama). */
  tenggat: string;
  selesaiPada: string | null;
  prioritas: Prioritas;
};

export type Penanda =
  { jenis: "terlambat"; tanggal: string } | { jenis: "tanpa_tenggat" } | null;

/**
 * Tanggal dari `?tanggal=`. Kosong, rusak, atau bukan tanggal sungguhan
 * jatuh ke hari ini — tanpa galat, karena tautan yang salah ketik tidak
 * layak menjadi halaman error.
 */
export function tanggalDariParam(
  nilai: string | string[] | undefined,
  hariIni: string,
): string {
  const teks = Array.isArray(nilai) ? nilai[0] : nilai;
  return teks && tanggalSah(teks) ? teks : hariIni;
}

/**
 * Pilihan papan dari `?tanggal=`: satu tanggal, hari ini (`hari-ini`),
 * atau — bila kosong/rusak — papan Semua, tampilan bawaan halaman Tugas.
 */
export function pilihanPapanDariParam(
  nilai: string | string[] | undefined,
  hariIni: string,
): string {
  const teks = Array.isArray(nilai) ? nilai[0] : nilai;
  if (teks === PARAM_HARI_INI) return hariIni;
  return teks && tanggalSah(teks) ? teks : SEMUA;
}

/** Tanggal (WIB) paling awal kolom Selesai papan Semua, inklusif. */
export function awalSelesaiSemua(hariIni: string): string {
  return geserTanggal(hariIni, -(HARI_SELESAI_SEMUA - 1));
}

/**
 * Deadline-nya sudah lewat pada waktu `sekarang`? Tenggat tanpa jam
 * tersimpan 23.59 WIB, jadi to-do bertanggal hari ini baru terlambat
 * setelah hari itu habis.
 */
export function lewatDeadline(tenggat: string, sekarang: string): boolean {
  const t = Date.parse(tenggat);
  const n = Date.parse(sekarang);
  return !Number.isNaN(t) && !Number.isNaN(n) && t < n;
}

/**
 * Awal dan akhir (eksklusif) satu hari WIB sebagai waktu UTC — untuk
 * menyaring kolom `timestamptz` per tanggal di basis data.
 */
export function rentangHariWib(tanggal: string): {
  awal: string;
  akhir: string;
} {
  const besok = geserTanggal(tanggal, 1);
  return {
    awal: new Date(`${tanggal}T00:00:00+07:00`).toISOString(),
    akhir: new Date(`${besok}T00:00:00+07:00`).toISOString(),
  };
}

/**
 * Awal tanggal `dari` dan akhir (eksklusif) tanggal `sampai`, keduanya
 * WIB, sebagai waktu UTC — `rentangHariWib` untuk beberapa hari
 * sekaligus, mis. satu bulan kalender.
 */
export function rentangTanggalWib(
  dari: string,
  sampai: string,
): { awal: string; akhir: string } {
  return {
    awal: rentangHariWib(dari).awal,
    akhir: rentangHariWib(sampai).akhir,
  };
}

/** Tanggal WIB tenggat sebuah tugas; "" bila tanpa tenggat. */
function tanggalTenggat(t: Pick<TugasPapan, "tenggat">): string {
  return t.tenggat ? keTanggalWib(t.tenggat) : "";
}

/**
 * Masuk papan tanggal ini? Padanan persis `where` di `papan_tugas`
 * (0182) — dipakai mode demo.
 */
export function masukPapan(
  t: TugasPapan,
  tanggal: string,
  hariIni: string,
): boolean {
  if (t.statusAsli === "dibatalkan") return false;

  if (t.status === "selesai") {
    return t.selesaiPada !== null && keTanggalWib(t.selesaiPada) === tanggal;
  }

  const hari = tanggalTenggat(t);
  if (hari === tanggal) return true;
  // Yang terlambat dan yang tanpa tenggat hanya menumpang di hari ini:
  // di tanggal lain mereka justru menutupi isi tanggal itu sendiri.
  return tanggal === hariIni && (hari === "" || hari < hariIni);
}

/**
 * Masuk papan Semua? Yang belum selesai dari tanggal mana pun, ditambah
 * yang beres dalam `HARI_SELESAI_SEMUA` hari terakhir. Padanan kueri
 * `ambilPapanSemua` — dipakai mode demo.
 */
export function masukPapanSemua(t: TugasPapan, hariIni: string): boolean {
  if (t.statusAsli === "dibatalkan") return false;
  if (t.status === "selesai") {
    return (
      t.selesaiPada !== null &&
      keTanggalWib(t.selesaiPada) >= awalSelesaiSemua(hariIni)
    );
  }
  return true;
}

/**
 * "To-do hari ini" di Beranda: bertenggat hari ini (apa pun statusnya,
 * supaya yang sudah dicentang tetap terhitung), atau terlambat dan belum
 * selesai. Padanan dua saringan di `ambilToDo`.
 */
export function masukToDoHariIni(
  t: { status: string; tenggat: string },
  hariIni: string,
): boolean {
  if (t.status === "dibatalkan") return false;
  const hari = tanggalTenggat(t);
  if (hari === hariIni) return true;
  return hari !== "" && hari < hariIni && t.status !== "selesai";
}

/**
 * Tanda di kartu: terlambat sejak tanggal berapa, atau tanpa deadline.
 *
 * Hanya di papan hari ini dan papan Semua — di tanggal lain, yang tampil
 * memang bertenggat tanggal itu. Dengan `sekarang`, deadline hari ini yang
 * jamnya sudah lewat ikut terlambat, bukan menunggu besok.
 */
export function penandaPapan(
  t: TugasPapan,
  tanggal: string,
  hariIni: string,
  sekarang?: string,
): Penanda {
  if ((tanggal !== hariIni && tanggal !== SEMUA) || t.status === "selesai") {
    return null;
  }
  const hari = tanggalTenggat(t);
  if (hari === "") return { jenis: "tanpa_tenggat" };
  if (hari < hariIni) return { jenis: "terlambat", tanggal: hari };
  if (hari === hariIni && sekarang && lewatDeadline(t.tenggat, sekarang)) {
    return { jenis: "terlambat", tanggal: hari };
  }
  return null;
}

const BOBOT: Record<Prioritas, number> = { tinggi: 0, sedang: 1, rendah: 2 };

/** Waktu untuk diurutkan; yang kosong ditaruh paling akhir. */
const waktu = (iso: string | null) => {
  const n = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
};

/**
 * Urutan di dalam satu kolom.
 *
 * Papan satu tanggal: prioritas dulu, lalu tenggat terdekat; yang
 * terlambat naik paling atas — itu yang paling menuntut perhatian hari
 * ini. Papan Semua: deadline terdekat dulu (yang terlambat otomatis di
 * atas), prioritas sebagai penentu bila deadline-nya sama. Kolom Selesai
 * kebalikannya: yang baru saja beres paling atas.
 */
export function urutkanKolom<T extends TugasPapan>(
  daftar: T[],
  status: StatusTugas,
  tanggal: string,
  hariIni: string,
  sekarang?: string,
): T[] {
  const salinan = [...daftar];

  if (status === "selesai") {
    return salinan.sort(
      (a, b) =>
        waktu(b.selesaiPada ?? b.tenggat) - waktu(a.selesaiPada ?? a.tenggat),
    );
  }

  if (tanggal === SEMUA) {
    return salinan.sort((a, b) => {
      const w = waktu(a.tenggat) - waktu(b.tenggat);
      if (w !== 0) return w;
      return BOBOT[a.prioritas] - BOBOT[b.prioritas];
    });
  }

  const telat = (t: T) =>
    penandaPapan(t, tanggal, hariIni, sekarang)?.jenis === "terlambat" ? 0 : 1;

  return salinan.sort((a, b) => {
    const t = telat(a) - telat(b);
    if (t !== 0) return t;
    const p = BOBOT[a.prioritas] - BOBOT[b.prioritas];
    if (p !== 0) return p;
    return waktu(a.tenggat) - waktu(b.tenggat);
  });
}

/** Seluruh papan: kartu per kolom, sudah terurut. */
export function susunPapan<T extends TugasPapan>(
  tugas: T[],
  tanggal: string,
  hariIni: string,
  sekarang?: string,
): Record<StatusTugas, T[]> {
  const kolom: Record<StatusTugas, T[]> = {
    todo: [],
    berjalan: [],
    menunggu_qc: [],
    selesai: [],
  };
  for (const t of tugas) kolom[t.status].push(t);

  for (const status of Object.keys(kolom) as StatusTugas[]) {
    kolom[status] = urutkanKolom(
      kolom[status],
      status,
      tanggal,
      hariIni,
      sekarang,
    );
  }
  return kolom;
}

/**
 * "To-do kamu: x dari y beres" untuk tanggal terpilih: to-do bertenggat
 * tanggal itu, dan berapa yang sudah selesai (kapan pun dicentangnya).
 */
export function ringkasToDoTanggal(
  tugas: (Pick<TugasPapan, "status" | "statusAsli" | "tenggat"> & {
    tipe: string;
  })[],
  tanggal: string,
) {
  const milik = tugas.filter(
    (t) =>
      t.tipe === "pribadi" &&
      t.statusAsli !== "dibatalkan" &&
      tanggalTenggat(t) === tanggal,
  );
  const selesai = milik.filter((t) => t.status === "selesai").length;
  return { total: milik.length, selesai };
}
