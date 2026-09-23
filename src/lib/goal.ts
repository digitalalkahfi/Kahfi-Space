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
