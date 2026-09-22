"use client";

import { BatasGalat } from "@/components/shared/batas-galat";

/** Modul Masukan & Masalah gagal dimuat. */
export default function GagalMasukanMasalah({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BatasGalat
      modul="Masukan & Masalah"
      judul="Masukan & masalah gagal dimuat"
      error={error}
      reset={reset}
    />
  );
}
