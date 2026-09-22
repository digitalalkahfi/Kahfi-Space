import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { jamWib, tanggalPendek } from "@/lib/format";
import { LABEL_STATUS_MASALAH } from "@/lib/masalah";
import type { JejakMasalah } from "@/lib/data/masalah";

/**
 * Riwayat status masalah.
 *
 * Yang ditampilkan bukan sekadar "pernah berubah", melainkan dari apa ke
 * apa dan oleh siapa — termasuk penutupan beserta alasannya, yang paling
 * perlu dibaca pelapornya.
 */
export function JejakMasalahKartu({ jejak }: { jejak: JejakMasalah[] }) {
  if (jejak.length === 0) return null;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <History className="size-4 text-muted-foreground" />
          Riwayat status
        </h2>
      </div>

      <ol className="space-y-2 px-5">
        {jejak.map((j) => (
          <li key={j.id} className="rounded-2xl bg-muted/50 p-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[13px] leading-[18px] font-semibold">
                {j.dari ? `${LABEL_STATUS_MASALAH[j.dari]} → ` : ""}
                {LABEL_STATUS_MASALAH[j.ke]}
                {j.olehNama ? ` · ${j.olehNama}` : ""}
              </span>
              <span className="text-[11px] leading-[14px] text-muted-foreground">
                {tanggalPendek(j.pada.slice(0, 10))} · {jamWib(j.pada)}
              </span>
            </div>
            {j.catatan ? (
              <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                {j.catatan}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}
