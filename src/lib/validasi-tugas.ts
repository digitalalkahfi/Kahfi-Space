/**
 * Aturan isian tugas — modul murni.
 *
 * Form memakainya untuk memberi tahu sebelum mengirim, Server Action
 * memakainya lagi sebelum menulis, dan basis data menjaga yang paling
 * penting sekali lagi (migrasi 0179–0181). Ditulis sekali di sini supaya
 * form dan Server Action tidak pernah berselisih soal apa yang sah.
 *
 * Semua tanggal adalah tanggal kalender WIB (YYYY-MM-DD) dan semua jam
 * adalah jam WIB (HH:MM); "hari ini" selalu datang dari pemanggil, bukan
 * dari jam dinding di sini — supaya bisa diuji dan supaya mode demo bisa
 * memakai tanggal acuannya sendiri.
 */

/** Hasil pemeriksaan: nilai yang sudah dirapikan, atau pesan untuk pengguna. */
export type Periksa<T> = { ok: true; nilai: T } | { ok: false; pesan: string };

const tolak = (pesan: string) => ({ ok: false as const, pesan });

/** Panjang minimal judul; sama dengan constraint `tasks.judul` (0009). */
export const MIN_JUDUL = 3;

/** Jam yang disimpan untuk to-do tanpa jam: batas hari itu. */
export const JAM_BATAS_HARI = "23:59";

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Bentuk YYYY-MM-DD yang juga tanggal sungguhan (bukan 2026-02-30). */
export function tanggalSah(nilai: string): boolean {
  if (!POLA_TANGGAL.test(nilai)) return false;
  const d = new Date(`${nilai}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === nilai;
}

/** Jam 24 jam HH:MM. */
export function jamSah(nilai: string): boolean {
  return POLA_JAM.test(nilai);
}

/** Tanggal kalender digeser `hari` hari (boleh negatif). */
export function geserTanggal(tanggal: string, hari: number): string {
  const [t, b, h] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(t, b - 1, h + hari)).toISOString().slice(0, 10);
}

/** Sabtu pada pekan tanggal itu; minggu kerja dianggap berakhir Sabtu. */
export function akhirPekan(tanggal: string): string {
  const hari = new Date(`${tanggal}T00:00:00Z`).getUTCDay();
  return geserTanggal(tanggal, 6 - hari);
}

export type Tenggat = {
  /** Nilai kolom `tenggat`, lengkap dengan zona +07:00. */
  tenggat: string;
  /** To-do tanpa jam: layar menampilkan tanggalnya saja. */
  tanpaJam: boolean;
};

/**
 * Tanggal + jam WIB menjadi nilai `tenggat`.
 *
 * Tanpa jam berarti batas hari itu (23:59 WIB) — bukan tengah malam di
 * awal hari, yang akan membuat to-do terbaca terlambat sejak pagi.
 */
export function susunTenggat(tanggal: string, jam: string | null): Tenggat {
  return jam
    ? { tenggat: `${tanggal}T${jam}:00+07:00`, tanpaJam: false }
    : { tenggat: `${tanggal}T${JAM_BATAS_HARI}:00+07:00`, tanpaJam: true };
}

/** Tanggal & jam tenggat: wajib bertanggal, tidak boleh sebelum hari ini. */
export function periksaTenggat(input: {
  tanggal: string | null | undefined;
  jam?: string | null;
  jamWajib: boolean;
  hariIni: string;
}): Periksa<Tenggat> {
  const tanggal = input.tanggal?.trim() ?? "";
  const jam = input.jam?.trim() || null;

  if (tanggal === "") return tolak("Pilih tanggalnya dulu.");
  if (!tanggalSah(tanggal)) {
    return tolak("Tanggal tidak dikenali. Pilih lewat kalender.");
  }
  if (tanggal < input.hariIni) {
    return tolak("Tanggal tidak boleh sebelum hari ini.");
  }
  if (jam === null) {
    if (input.jamWajib) return tolak("Isi jam tenggatnya, mis. 17:00.");
  } else if (!jamSah(jam)) {
    return tolak("Jam tidak dikenali. Tulis seperti 17:00.");
  }

  return { ok: true, nilai: susunTenggat(tanggal, jam) };
}

/** To-do baru: judul dan tanggal wajib, jam opsional (D3). */
export function periksaToDoBaru(input: {
  judul: string;
  tanggal: string | null | undefined;
  jam?: string | null;
  hariIni: string;
}): Periksa<{ judul: string } & Tenggat> {
  const judul = input.judul.trim();
  if (judul.length < MIN_JUDUL) {
    return tolak(`Judul to-do minimal ${MIN_JUDUL} karakter.`);
  }

  const tenggat = periksaTenggat({
    tanggal: input.tanggal,
    jam: input.jam,
    jamWajib: false,
    hariIni: input.hariIni,
  });
  if (!tenggat.ok) return tenggat;

  return { ok: true, nilai: { judul, ...tenggat.nilai } };
}

/**
 * Tiket & komitmen baru: tanggal DAN jam wajib (D3). Komitmen mingguan
 * wajib menempel pada goal; tiket biasa boleh tanpa goal (D6).
 */
export function periksaTiketBaru(input: {
  judul: string;
  penerimaId: string;
  tipe: "tiket" | "komitmen_mingguan";
  goalId?: string | null;
  tanggal: string | null | undefined;
  jam?: string | null;
  hariIni: string;
}): Periksa<{ judul: string; goalId: string | null } & Tenggat> {
  const judul = input.judul.trim();
  if (judul.length < MIN_JUDUL) {
    return tolak(`Judul tiket minimal ${MIN_JUDUL} karakter.`);
  }
  if (!input.penerimaId) return tolak("Pilih penerima tiket.");

  const goalId = input.goalId || null;
  if (input.tipe === "komitmen_mingguan" && !goalId) {
    return tolak("Komitmen mingguan harus terhubung ke sebuah goal.");
  }

  const tenggat = periksaTenggat({
    tanggal: input.tanggal,
    jam: input.jam,
    jamWajib: true,
    hariIni: input.hariIni,
  });
  if (!tenggat.ok) return tenggat;

  return { ok: true, nilai: { judul, goalId, ...tenggat.nilai } };
}
