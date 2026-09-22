/**
 * Halaman gabungan Masukan & Kaizen — pembacaan tab, murni.
 *
 * Tiga tab menyatukan dua modul yang selama ini terpisah: masukan/bug
 * dari pemakai aplikasi, dan laporan Kaizen dari lapangan. Keduanya
 * berakhir pada pertanyaan yang sama: sudah ditindak atau belum.
 *
 * Tab keempat dulu berisi daftar tindakan lintas masalah. Ia hilang
 * bersama tabelnya pada migrasi 0121 — "yang menunggu jawaban" kini
 * sekadar saringan status di tab Kaizen.
 */
export type TabTerpadu = "masukan" | "bug" | "masalah";

const TAB_SAH: TabTerpadu[] = ["masukan", "bug", "masalah"];

/** Membaca tab dari URL; nilai asing jatuh ke tab pertama. */
export function bacaTab(nilai: string | string[] | undefined): TabTerpadu {
  const satu = Array.isArray(nilai) ? nilai[0] : nilai;
  return TAB_SAH.includes(satu as TabTerpadu)
    ? (satu as TabTerpadu)
    : "masukan";
}
