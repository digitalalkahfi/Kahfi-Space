"use client";

import { BatasGalat } from "@/components/shared/batas-galat";

/** Halaman Budget gagal dimuat. */
export default function GagalBudget({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BatasGalat
      modul="Budget"
      judul="Anggaran gagal dimuat"
      error={error}
      reset={reset}
    />
  );
}
