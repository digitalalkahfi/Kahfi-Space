/**
 * Siapa boleh melihat angka komisi (docs/KOMISI-DETAIL-AKUN-AFFILIATOR.md
 * §4.5, §5, keputusan K5–K7). Cerminan fungsi database
 * `boleh_lihat_komisi()` (0210) dan `boleh_lihat_komisi(account_id)`
 * (0212) — yang menegakkan aturannya adalah database; fungsi di sini
 * hanya menentukan apa yang perlu digambar.
 */
import type { Peran } from "@/lib/types";
import type { CakupanAksesKomisiDb } from "@/lib/supabase/types";

/**
 * Komisi semua akun, kartu total Komisi, halaman detail per akun, dan
 * mengatur akses lihat: hanya CEO & Manager (K3, K6, K7).
 */
export function bolehLihatKomisiSemua(peran: Peran): boolean {
  return peran === "CEO" || peran === "Manager";
}

/** Pilihan akses lihat komisi; "tidak" = tanpa baris (bawaan). */
export type PilihanAksesKomisi = "tidak" | CakupanAksesKomisiDb;

export const PILIHAN_AKSES_KOMISI: {
  nilai: PilihanAksesKomisi;
  label: string;
  keterangan: string;
}[] = [
  {
    nilai: "tidak",
    label: "Tidak ada",
    keterangan:
      "Tidak melihat angka komisi apa pun, termasuk laporannya sendiri setelah terkirim.",
  },
  {
    nilai: "pegangan",
    label: "Akun yang dia pegang",
    keterangan:
      "Komisi akun yang saat ini ia pegang sebagai PIC. Ikut berubah bila akun dipindah PIC.",
  },
  {
    nilai: "tertentu",
    label: "Akun tertentu",
    keterangan: "Komisi akun yang dipilih satu per satu di bawah.",
  },
  {
    nilai: "semua",
    label: "Semua akun Affiliator",
    keterangan:
      "Komisi seluruh akun Affiliator, tetapi tidak kartu total Komisi di dasbor.",
  },
];

export function labelAksesKomisi(nilai: PilihanAksesKomisi | null): string {
  return (
    PILIHAN_AKSES_KOMISI.find((p) => p.nilai === (nilai ?? "tidak"))?.label ??
    "Tidak ada"
  );
}

/**
 * Akun yang komisinya terlihat: "semua" bagi CEO/Manager, atau himpunan
 * id akun bagi yang lain (bisa kosong).
 */
export type KomisiTerlihat = "semua" | ReadonlySet<string>;

export function komisiAkunTerlihat(
  terlihat: KomisiTerlihat,
  accountId: string | null,
): boolean {
  if (terlihat === "semua") return true;
  return accountId !== null && terlihat.has(accountId);
}
