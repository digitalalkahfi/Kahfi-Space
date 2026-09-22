"use client";

import { useState, useTransition } from "react";
import { Loader2, Power, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ubahAktifIndikatorKpi } from "@/app/actions/kpi";

/**
 * Menyalakan atau mematikan satu indikator KPI.
 *
 * Akibatnya disebutkan di layar setelah tersimpan: bulan berjalan langsung
 * dihitung ulang, bulan yang sudah dikunci tidak tersentuh.
 */
export function AksiIndikatorKpi({
  indikatorId,
  aktif,
}: {
  indikatorId: string;
  aktif: boolean;
}) {
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const kirim = () => {
    if (menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await ubahAktifIndikatorKpi(indikatorId, !aktif);
      setPesan(hasil.pesan ?? null);
    });
  };

  return (
    <div className="mt-2 space-y-1">
      <button
        type="button"
        onClick={kirim}
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
        {aktif ? "Nonaktifkan" : "Aktifkan lagi"}
      </button>
      {pesan ? (
        <p
          role="status"
          className="text-[11px] leading-[14px] text-muted-foreground"
        >
          {pesan}
        </p>
      ) : null}
    </div>
  );
}
