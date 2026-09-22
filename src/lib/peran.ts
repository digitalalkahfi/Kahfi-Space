/**
 * Peran pengguna — modul murni, aman dipakai server maupun browser.
 * Urutannya dari cakupan terluas ke tersempit, dipakai untuk mengurutkan
 * tampilan sekaligus memvalidasi parameter URL.
 */
import type { Peran } from "@/lib/types";

export const URUTAN_PERAN: Peran[] = [
  "CEO",
  "Manager",
  "Leader",
  "Co-Leader",
  "Staff",
  "Finance",
];

export function peranSah(nilai: unknown): nilai is Peran {
  return typeof nilai === "string" && URUTAN_PERAN.includes(nilai as Peran);
}

/**
 * Peringkat peran untuk garis pelaporan — padanan `peringkat_peran()`
 * di database (migrasi 0070). Makin kecil, makin luas cakupannya.
 *
 * Finance berdiri di luar garis unit dan disetarakan dengan Staff:
 * bukan atasan siapa pun, tetapi juga bukan bawahan Staff.
 */
export function peringkatPeran(peran: Peran) {
  return peran === "Finance"
    ? URUTAN_PERAN.indexOf("Staff")
    : URUTAN_PERAN.indexOf(peran);
}
