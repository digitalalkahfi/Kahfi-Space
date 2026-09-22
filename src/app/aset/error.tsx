"use client";

import { BatasGalat } from "@/components/shared/batas-galat";

/** Modul Aset gagal dimuat. */
export default function GagalAset({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BatasGalat
      modul="Aset"
      judul="Daftar aset gagal dimuat"
      error={error}
      reset={reset}
    />
  );
}
