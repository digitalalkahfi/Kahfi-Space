import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen } from "@/lib/format";
import { gayaKeputusanWrm } from "@/lib/unit";
import { ARTI_WRM } from "@/lib/wrm";
import { AMBANG_WRM, type StatusWrm } from "@/lib/data/grd";

/** Matriks WRM: Hasil (lagging) × KRI (leading) → satu keputusan. */
export function KartuWrm({ wrm }: { wrm: StatusWrm }) {
  const gaya = gayaKeputusanWrm[wrm.keputusan];

  const sumbu = [
    {
      label: "Hasil GMV tim",
      rasio: wrm.rasioHasil,
      ambang: AMBANG_WRM.hasil,
      hijau: wrm.hasilHijau,
    },
    {
      label: "KRI lead indicator",
      rasio: wrm.rasioKri,
      ambang: AMBANG_WRM.kri,
      hijau: wrm.kriHijau,
    },
  ];

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <ShieldCheck className="size-4 text-muted-foreground" />
          Status Matriks WRM
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] leading-[14px] font-semibold tracking-[0.04em] uppercase",
            gaya.kelas,
          )}
        >
          <span className={cn("size-1.5 rounded-full", gaya.titik)} />
          {wrm.keputusan}
        </span>
      </div>

      <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
        {ARTI_WRM[wrm.keputusan]}
      </p>

      <div className="grid grid-cols-2 gap-3 px-5">
        {sumbu.map((s) => (
          <div
            key={s.label}
            className={cn(
              "rounded-2xl p-3.5",
              s.hijau ? "bg-ok-fill" : "bg-danger-fill",
            )}
          >
            <p
              className={cn(
                "text-[11px] leading-[14px] font-semibold",
                s.hijau ? "text-ok-text" : "text-danger-text",
              )}
            >
              {s.label}
            </p>
            <p className="tabular mt-1 flex items-baseline gap-1.5">
              <span
                className={cn(
                  "text-[20px] leading-7 font-bold tracking-tight",
                  s.hijau ? "text-ok-text" : "text-danger-text",
                )}
              >
                {persen(s.rasio)}
              </span>
              <span className="text-[11px] leading-[14px] text-muted-foreground">
                {s.hijau ? "≥" : "<"} {persen(s.ambang, 0)}
              </span>
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
