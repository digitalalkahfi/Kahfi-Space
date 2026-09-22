import Link from "next/link";
import { cn } from "@/lib/utils";
import { bulanPendek } from "@/lib/format";
import { geserBulan } from "@/lib/kalender";

/**
 * Pemilih bulan scorecard.
 *
 * Tanpa ini penguncian tidak pernah bisa dijalankan: bulan berjalan selalu
 * ditolak database karena belum selesai, sedangkan bulan yang sudah selesai
 * tak punya jalan untuk dibuka lagi.
 */
export function PilihBulanKpi({
  bulanAktif,
  bulanIni,
  persona,
  jumlah = 6,
}: {
  bulanAktif: string;
  bulanIni: string;
  persona?: string;
  jumlah?: number;
}) {
  const daftar = Array.from({ length: jumlah }, (_, i) =>
    geserBulan(bulanIni, -i),
  );

  return (
    <nav
      aria-label="Pilih bulan scorecard"
      className="flex flex-wrap gap-1 overflow-x-auto"
    >
      {daftar.map((b) => {
        const parameter = new URLSearchParams({ bulan: b });
        if (persona) parameter.set("persona", persona);
        return (
          <Link
            key={b}
            href={`/grd/scorecard?${parameter.toString()}`}
            aria-current={b === bulanAktif ? "page" : undefined}
            className={cn(
              "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
              b === bulanAktif
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
            )}
          >
            {bulanPendek(b)}
          </Link>
        );
      })}
    </nav>
  );
}
