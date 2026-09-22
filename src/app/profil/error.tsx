"use client";

import { BatasGalat } from "@/components/shared/batas-galat";

/** Profil Saya gagal dimuat. */
export default function GagalProfil({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BatasGalat
      modul="Profil"
      judul="Profil gagal dimuat"
      error={error}
      reset={reset}
    />
  );
}
