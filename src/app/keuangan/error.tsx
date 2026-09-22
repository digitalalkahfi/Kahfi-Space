"use client";

import { BatasGalat } from "@/components/shared/batas-galat";

/**
 * Dasbor Finance gagal dimuat.
 *
 * Angka keuangan tidak ditampilkan setengah-setengah: lebih baik kosong
 * daripada salah.
 */
export default function GagalKeuangan({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BatasGalat
      modul="Keuangan"
      judul="Dasbor keuangan gagal dimuat"
      error={error}
      reset={reset}
    />
  );
}
