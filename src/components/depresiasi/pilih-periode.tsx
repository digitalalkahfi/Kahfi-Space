"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { bulanPendek } from "@/lib/format";

/** Pemilih periode beban penyusutan; tinggal di dalam modulnya sendiri. */
export function PilihPeriodeDepresiasi({
  periode,
  tersedia,
}: {
  periode: string;
  tersedia: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (tersedia.length <= 1) return null;

  const pindah = (ke: string) => {
    const baru = new URLSearchParams(params.toString());
    baru.set("periode", ke);
    router.replace(`${pathname}?${baru.toString()}`, { scroll: false });
  };

  return (
    <div
      role="group"
      aria-label="Periode penyusutan"
      className="-mx-1 flex gap-1 overflow-x-auto rounded-full bg-muted p-1"
    >
      {tersedia.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => pindah(p)}
          aria-pressed={p === periode}
          className={cn(
            "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
            p === periode
              ? "bg-card text-foreground shadow-card"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {bulanPendek(p)}
        </button>
      ))}
    </div>
  );
}
