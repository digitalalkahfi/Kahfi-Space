"use client";

import { BatasGalat } from "@/components/shared/batas-galat";

/** Dasbor Analitik GMV gagal dimuat. */
export default function GagalGmv({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BatasGalat
      modul="Analitik GMV"
      judul="Analitik GMV gagal dimuat"
      error={error}
      reset={reset}
    />
  );
}
