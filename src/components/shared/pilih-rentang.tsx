"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { PILIHAN_PERIODE, type Periode } from "@/lib/periode";

/**
 * Pemilih rentang tanggal berbasis URL, jadi hasilnya bisa dibagikan
 * dan ditekan "kembali" seperti halaman biasa.
 */
export function PilihRentang({ periode }: { periode: Periode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const pindah = (nilai: string) => {
    const baru = new URLSearchParams(params.toString());
    baru.set("periode", nilai);
    baru.delete("dari");
    baru.delete("sampai");
    router.replace(`${pathname}?${baru.toString()}`, { scroll: false });
  };

  const ubahTanggal = (kunci: "dari" | "sampai", nilai: string) => {
    if (!nilai) return;
    const baru = new URLSearchParams(params.toString());
    baru.set("periode", "kustom");
    baru.set("dari", kunci === "dari" ? nilai : periode.dari);
    baru.set("sampai", kunci === "sampai" ? nilai : periode.sampai);
    router.replace(`${pathname}?${baru.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {PILIHAN_PERIODE.map((p) => (
          <button
            key={p.kunci}
            type="button"
            onClick={() => pindah(p.kunci)}
            aria-pressed={p.kunci === periode.kunci}
            className={cn(
              "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold",
              p.kunci === periode.kunci
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] leading-[14px] text-muted-foreground">
        <CalendarRange className="size-3.5 shrink-0" />
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Tanggal mulai</span>
          <input
            type="date"
            value={periode.dari}
            max={periode.sampai}
            onChange={(e) => ubahTanggal("dari", e.target.value)}
            className="tabular rounded-lg bg-card px-2 py-1 ring-1 ring-border-subtle"
          />
        </label>
        <span aria-hidden>–</span>
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Tanggal akhir</span>
          <input
            type="date"
            value={periode.sampai}
            min={periode.dari}
            onChange={(e) => ubahTanggal("sampai", e.target.value)}
            className="tabular rounded-lg bg-card px-2 py-1 ring-1 ring-border-subtle"
          />
        </label>
      </div>
    </div>
  );
}
