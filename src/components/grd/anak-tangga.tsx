import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen, rupiahRingkas } from "@/lib/format";
import type { AnakTangga } from "@/lib/data/grd";

/**
 * Anak tangga target: bagaimana goal perusahaan diturunkan ke Manager
 * lalu ke tiap unit, beserta posisi capaiannya.
 */
export function TanggaTarget({ tangga }: { tangga: AnakTangga[] }) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Anak tangga target
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Roll-down dari perusahaan ke tiap unit
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-[11px] leading-[14px] font-semibold text-muted-foreground">
          {tangga.length} level aktif
        </span>
      </div>

      <ol className="space-y-2 px-5">
        {tangga.map((t, i) => {
          const kuat = t.rasio >= 90;
          const sedang = t.rasio >= 75;
          return (
            <li
              key={t.id}
              className="baris-interaktif flex items-center gap-3 rounded-2xl bg-muted/60 p-3.5"
            >
              <span
                className={cn(
                  "tabular flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  i === 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm leading-5 font-semibold">
                  {t.pemilik}
                </p>
                <p className="tabular truncate text-[11px] leading-[14px] text-muted-foreground">
                  {t.jabatan || t.judul} · {rupiahRingkas(t.target)}
                </p>
              </div>

              <span
                className={cn(
                  "tabular flex shrink-0 items-center gap-1 text-[13px] leading-[18px] font-bold",
                  kuat
                    ? "text-ok-text"
                    : sedang
                      ? "text-warn-text"
                      : "text-danger-text",
                )}
              >
                {persen(t.rasio)}
                {kuat ? <CheckCircle2 className="size-3.5" /> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
