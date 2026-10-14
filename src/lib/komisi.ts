/**
 * Siapa boleh melihat angka komisi (docs/KOMISI-DETAIL-AKUN-AFFILIATOR.md
 * §5, keputusan K5). Cerminan fungsi database `boleh_lihat_komisi()` dan
 * `komisi_laporan()` (0210) — yang menegakkan aturannya adalah database;
 * fungsi di sini hanya menentukan apa yang perlu digambar.
 */
import type { Peran } from "@/lib/types";

/** Komisi siapa pun, kartu Komisi, dan detail per akun: CEO & Manager. */
export function bolehLihatKomisiSemua(peran: Peran): boolean {
  return peran === "CEO" || peran === "Manager";
}

/**
 * Komisi laporan yang ia kirim sendiri: Staff (dan CEO/Manager, yang
 * memang melihat semua). Leader dan Co-Leader mengisi komisi, tetapi
 * tidak melihat angkanya lagi — termasuk miliknya sendiri.
 */
export function bolehLihatKomisiSendiri(peran: Peran): boolean {
  return peran === "Staff" || bolehLihatKomisiSemua(peran);
}
