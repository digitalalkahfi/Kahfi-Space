"use client";

import { BatasGalat } from "@/components/shared/batas-galat";

/** Halaman preferensi notifikasi gagal dimuat. */
export default function GagalPreferensi({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BatasGalat
      modul="Preferensi notifikasi"
      judul="Preferensi gagal dimuat"
      error={error}
      reset={reset}
    />
  );
}
