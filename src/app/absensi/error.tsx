"use client";

import { BatasGalat } from "@/components/shared/batas-galat";

/** Modul Absensi (termasuk izin dan rekap) gagal dimuat. */
export default function GagalAbsensi({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BatasGalat
      modul="Absensi"
      judul="Absensi gagal dimuat"
      error={error}
      reset={reset}
    />
  );
}
