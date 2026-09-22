"use client";

import { BatasGalat } from "@/components/shared/batas-galat";

/** Pusat notifikasi gagal dimuat. */
export default function GagalNotifikasi({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BatasGalat
      modul="Notifikasi"
      judul="Notifikasi gagal dimuat"
      error={error}
      reset={reset}
    />
  );
}
