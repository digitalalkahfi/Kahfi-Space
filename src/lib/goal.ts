/** Aturan goal yang dipakai server maupun layar; tanpa akses database. */
import { geserBulan } from "@/lib/kalender";
import { hariDalamBulan } from "@/lib/periode-finance";

/** Batas lead measure aktif per goal; ditegakkan trigger `batasi_lead_measure`. */
export const MAKS_LEAD_MEASURE = 3;

export type LevelGoal = "company" | "manager" | "leader" | "account" | "staff";

export const LEVEL_GOAL: LevelGoal[] = [
  "company",
  "manager",
  "leader",
  "account",
  "staff",
];

export const NAMA_LEVEL: Record<LevelGoal, string> = {
  company: "Perusahaan",
  manager: "Manager",
  leader: "Leader / unit",
  account: "Akun",
  staff: "Staf",
};

/** Induk yang sah berada lebih tinggi di tangga roll-down — sejalan 0065. */
export function bolehJadiInduk(anak: LevelGoal, induk: LevelGoal) {
  return LEVEL_GOAL.indexOf(induk) < LEVEL_GOAL.indexOf(anak);
}

/**
 * Anak tangga bulanan: target dibagi rata, sisa pembulatan jatuh ke bulan
 * terakhir supaya jumlah seluruh bulan persis sama dengan target goal.
 */
export function anakTangga(mulai: string, jumlahBulan: number, target: number) {
  const dasar = Math.floor(target / jumlahBulan);
  return Array.from({ length: jumlahBulan }, (_, i) => ({
    bulan: geserBulan(mulai, i),
    target: i === jumlahBulan - 1 ? target - dasar * (jumlahBulan - 1) : dasar,
  }));
}

/** Label periode goal, mis. "2024-Q4" — sejalan isi kolom `goals.periode`. */
export function periodeKuartal(tanggal: string) {
  const bulan = Number(tanggal.slice(5, 7));
  return `${tanggal.slice(0, 4)}-Q${Math.ceil(bulan / 3)}`;
}

/**
 * Target harian sebuah goal pada satu tanggal: anak tangga bulan itu
 * dibagi rata jumlah harinya.
 *
 * Rumusnya sengaja sama persis dengan `target_harian_akun` dan
 * `target_harian_unit` di database (migrasi 0006). Pelapor tidak pernah
 * mengetik target; angka ini satu-satunya sumbernya, dan mode demo harus
 * menghasilkan angka yang sama dengan mode Supabase — bukan mirip.
 */
export function targetHarianGrd(
  bulanList: readonly { bulan: string; target: number }[],
  tanggal: string,
): number {
  const bulanIni = `${tanggal.slice(0, 7)}-01`;
  const sebulan = bulanList
    .filter((b) => b.bulan.slice(0, 7) === bulanIni.slice(0, 7))
    .reduce((jumlah, b) => jumlah + b.target, 0);
  return sebulan > 0 ? sebulan / hariDalamBulan(tanggal) : 0;
}

// ---------------------------------------------------------------------
// Periode goal
//
// Periode sebuah goal adalah deretan bulan anak tangganya: bulan mulai
// dan lamanya. Satu aturan ini dipakai dialog tambah, dialog ubah, dan
// server, supaya yang dipratinjau persis yang disimpan.
// ---------------------------------------------------------------------

/** Lama periode yang boleh dipilih, sejalan pemeriksaan server. */
export const MAKS_BULAN_GOAL = 12;

/**
 * Cara membaca angka target sebuah goal berperiode lebih dari sebulan:
 * - "bulanan": angka itu berlaku untuk SETIAP bulan (GMV bulanan);
 * - "total"  : angka itu untuk seluruh periode, dibagi rata per bulan.
 * Untuk periode sebulan keduanya sama.
 */
export type ModeTarget = "bulanan" | "total";

export const NAMA_MODE_TARGET: Record<ModeTarget, string> = {
  bulanan: "Sama setiap bulan",
  total: "Total seluruh periode",
};

/** Bulan terakhir sebuah periode, bentuk "YYYY-MM-01". */
export function akhirPeriode(mulai: string, jumlahBulan: number): string {
  return geserBulan(mulai, Math.max(1, jumlahBulan) - 1);
}

/** Banyaknya bulan dari `mulai` sampai `sampai`, keduanya ikut dihitung. */
export function jumlahBulanAntara(mulai: string, sampai: string): number {
  const [ta, ba] = [Number(mulai.slice(0, 4)), Number(mulai.slice(5, 7))];
  const [tb, bb] = [Number(sampai.slice(0, 4)), Number(sampai.slice(5, 7))];
  return (tb - ta) * 12 + (bb - ba) + 1;
}

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

const namaBulan = (bulan: string) =>
  BULAN_PENDEK[Number(bulan.slice(5, 7)) - 1];

/**
 * Label periode yang dibaca orang: "Okt 2026", "Okt – Des 2026", atau
 * "Nov 2026 – Jan 2027". Disimpan juga di kolom `goals.periode`.
 */
export function labelPeriode(mulai: string, jumlahBulan: number): string {
  const akhir = akhirPeriode(mulai, jumlahBulan);
  const tahunMulai = mulai.slice(0, 4);
  const tahunAkhir = akhir.slice(0, 4);
  if (jumlahBulan <= 1) return `${namaBulan(mulai)} ${tahunMulai}`;
  if (tahunMulai === tahunAkhir) {
    return `${namaBulan(mulai)} – ${namaBulan(akhir)} ${tahunAkhir}`;
  }
  return `${namaBulan(mulai)} ${tahunMulai} – ${namaBulan(akhir)} ${tahunAkhir}`;
}

/** Anak tangga menurut cara baca targetnya. */
export function susunAnakTangga(
  mulai: string,
  jumlahBulan: number,
  target: number,
  mode: ModeTarget,
): { bulan: string; target: number }[] {
  if (mode === "total") return anakTangga(mulai, jumlahBulan, target);
  return Array.from({ length: jumlahBulan }, (_, i) => ({
    bulan: geserBulan(mulai, i),
    target,
  }));
}

/**
 * Cara baca target sebuah goal yang sudah tersimpan, ditebak dari anak
 * tangganya. "kustom" berarti bulannya tidak rata menurut kedua cara —
 * mis. data lama yang targetnya menanjak tiap bulan.
 */
export function tebakModeTarget(
  bulan: readonly { target: number }[],
  targetGoal: number,
): ModeTarget | "kustom" {
  if (bulan.length <= 1) return "bulanan";
  if (bulan.every((b) => b.target === targetGoal)) return "bulanan";
  const jumlah = bulan.reduce((a, b) => a + b.target, 0);
  if (Math.abs(jumlah - targetGoal) < 1) return "total";
  return "kustom";
}

/** Letak tanggal acuan terhadap periode goal. */
export function statusPeriode(
  mulai: string,
  jumlahBulan: number,
  tanggal: string,
): "belum" | "berjalan" | "lewat" {
  const bulanIni = `${tanggal.slice(0, 7)}-01`;
  if (bulanIni < mulai) return "belum";
  if (bulanIni > akhirPeriode(mulai, jumlahBulan)) return "lewat";
  return "berjalan";
}

/**
 * Pilihan bulan mulai: beberapa bulan ke belakang untuk membetulkan goal
 * yang terlanjur dibuat, dan setahun ke depan. Bulan yang sedang dipakai
 * sebuah goal selalu ikut, walau di luar rentang itu.
 */
export function pilihanBulanMulai(
  acuan: string,
  sertakan: string | null = null,
  mundur = 3,
  maju = 12,
): string[] {
  const awal = `${acuan.slice(0, 7)}-01`;
  const hasil = new Set<string>();
  for (let i = -mundur; i <= maju; i += 1) hasil.add(geserBulan(awal, i));
  if (sertakan) hasil.add(`${sertakan.slice(0, 7)}-01`);
  return [...hasil].sort();
}
