"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KeadaanGagal } from "@/components/shared/keadaan";

/**
 * Isi baku berkas error.tsx sebuah modul.
 *
 * Ditarik jadi satu komponen karena tiap modul butuh hal yang sama:
 * mencatat galatnya ke konsol, menyebut modul mana yang gagal, memberi
 * jalan keluar (coba lagi / kembali), dan menampilkan kode galat kalau
 * ada. Yang berbeda hanya kalimat judulnya — itu saja yang jadi prop.
 *
 * Pesan galat aslinya sengaja tidak ditampilkan: ia menyebut nama tabel
 * dan kolom, dan itu bukan untuk semua mata. Yang berguna bagi pelapor
 * adalah `digest`-nya.
 */
export function BatasGalat({
  modul,
  judul,
  pesan = "Coba muat ulang. Bila berulang, laporkan lewat menu Masukan & Masalah — sertakan kode galat di bawah bila ada.",
  error,
  reset,
}: {
  /** Nama modul untuk catatan konsol, mis. "Tugas". */
  modul: string;
  judul: string;
  pesan?: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(`Gagal memuat modul ${modul}:`, error);
  }, [modul, error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4 lg:px-8 lg:pt-6">
      <KeadaanGagal
        judul={judul}
        pesan={pesan}
        kode={error.digest}
        aksi={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={reset}
              className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
            >
              <RotateCcw className="size-3.5" />
              Coba lagi
            </Button>
            <Link
              href="/beranda"
              className="tekan-halus sentuh-nyaman inline-flex h-9 items-center rounded-full bg-card px-4 text-[11px] leading-[14px] font-semibold ring-1 ring-border-subtle"
            >
              Kembali ke beranda
            </Link>
          </div>
        }
      />
    </div>
  );
}
