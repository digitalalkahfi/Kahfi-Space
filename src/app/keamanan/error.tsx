"use client";

import { BatasGalat } from "@/components/shared/batas-galat";

/** Halaman Keamanan Akun gagal dimuat. */
export default function GagalKeamanan({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BatasGalat
      modul="Keamanan akun"
      judul="Keamanan akun gagal dimuat"
      error={error}
      reset={reset}
    />
  );
}
