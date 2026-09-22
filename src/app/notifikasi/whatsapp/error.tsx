"use client";

import { BatasGalat } from "@/components/shared/batas-galat";

/** Riwayat pengiriman WhatsApp gagal dimuat. */
export default function GagalKirimWa({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BatasGalat
      modul="Pengiriman WhatsApp"
      judul="Riwayat pengiriman gagal dimuat"
      error={error}
      reset={reset}
    />
  );
}
