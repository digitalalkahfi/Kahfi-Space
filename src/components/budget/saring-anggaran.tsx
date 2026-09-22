"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bulanPendek } from "@/lib/format";
import type { SaringanAnggaran } from "@/lib/budget";

/**
 * Saringan anggaran: periode dan divisi, disimpan di URL.
 *
 * Filter periode memang tinggal di dalam modulnya, bukan di navigasi atas
 * (PRD Fase 1) — "bulan ini" berarti lain di Budget, di absensi, dan di
 * laporan harian.
 */
export function SaringAnggaran({
  saringan,
  periode,
  unit,
  jumlah,
  total,
}: {
  saringan: SaringanAnggaran;
  periode: string[];
  unit: string[];
  jumlah: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const pindah = (ubah: Record<string, string>) => {
    const baru = new URLSearchParams(params.toString());
    for (const [kunci, nilai] of Object.entries(ubah)) {
      if (!nilai || nilai === "semua") baru.delete(kunci);
      else baru.set(kunci, nilai);
    }
    const query = baru.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const pil = (
    aktif: boolean,
    label: string,
    saatKlik: () => void,
    kunci: string,
  ) => (
    <button
      key={kunci}
      type="button"
      onClick={saatKlik}
      aria-pressed={aktif}
      className={cn(
        "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
        aktif
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  const menyaring = saringan.unit !== "semua";

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-3 px-5">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {periode.map((p) =>
            pil(
              saringan.periode === p,
              bulanPendek(p),
              () => pindah({ periode: p }),
              `periode-${p}`,
            ),
          )}
        </div>

        {unit.length > 1 ? (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {pil(
              saringan.unit === "semua",
              "Semua divisi",
              () => pindah({ unit: "semua" }),
              "unit-semua",
            )}
            {unit.map((u) =>
              pil(
                saringan.unit === u,
                u,
                () => pindah({ unit: saringan.unit === u ? "semua" : u }),
                `unit-${u}`,
              ),
            )}
          </div>
        ) : null}

        <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] leading-[14px] text-muted-foreground">
          <span>
            {menyaring
              ? `${jumlah} dari ${total} pos`
              : `${total} pos anggaran`}
          </span>
          {menyaring ? (
            <button
              type="button"
              onClick={() => pindah({ unit: "semua" })}
              className="tekan-halus sentuh-nyaman inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold hover:text-foreground"
            >
              <X className="size-3.5" />
              Hapus saringan
            </button>
          ) : null}
        </p>
      </div>
    </Card>
  );
}
