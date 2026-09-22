"use client";

import { useState, useTransition } from "react";
import { Loader2, Power, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ubahAktifKursus } from "@/app/actions/lms";

/**
 * Memensiunkan kursus atau menghidupkannya kembali.
 *
 * Kursus yang sudah diikuti orang tidak bisa dihapus — riwayat belajar
 * mereka menggantung padanya (0088) — jadi inilah cara menariknya dari
 * katalog tanpa menghapus apa pun.
 */
export function TombolAktifKursus({
  kursusId,
  aktif,
}: {
  kursusId: string;
  aktif: boolean;
}) {
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const alihkan = () => {
    if (menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await ubahAktifKursus(kursusId, !aktif);
      setPesan(hasil.pesan ?? null);
    });
  };

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={alihkan}
        disabled={menyimpan}
        className={cn(
          "tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] leading-[14px] font-semibold",
          aktif
            ? "bg-card text-muted-foreground hover:text-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {menyimpan ? (
          <Loader2 className="size-3 animate-spin" />
        ) : aktif ? (
          <Power className="size-3" />
        ) : (
          <RotateCcw className="size-3" />
        )}
        {aktif ? "Pensiunkan" : "Aktifkan lagi"}
      </button>
      {pesan ? (
        <span
          role="status"
          className="max-w-[16rem] text-right text-[11px] leading-[14px] text-pretty text-muted-foreground"
        >
          {pesan}
        </span>
      ) : null}
    </span>
  );
}
