"use client";

import { BatasGalat } from "@/components/shared/batas-galat";

/** Modul Sampel gagal dimuat. */
export default function GagalSampel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BatasGalat
      modul="Sampel"
      judul="Daftar sampel gagal dimuat"
      error={error}
      reset={reset}
    />
  );
}
