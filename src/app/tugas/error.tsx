"use client";

import { BatasGalat } from "@/components/shared/batas-galat";

/** Modul Tugas gagal dimuat. */
export default function GagalTugas({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BatasGalat
      modul="Tugas"
      judul="Papan tugas gagal dimuat"
      error={error}
      reset={reset}
    />
  );
}
