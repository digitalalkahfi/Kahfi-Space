import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { jamWib, persen, rasioCapaian, rupiahRingkas } from "@/lib/format";
import { gayaKeputusanWrm } from "@/lib/unit";
import { AngkaBerjalan } from "@/components/motion/angka-berjalan";
import { BarCapaian } from "@/components/motion/bar-capaian";
import type { KeputusanWrm } from "@/lib/types";

/**
 * "Hari ini kita di mana?" — satu pandangan GMV hari ini vs target harian,
 * dengan keputusan matriks WRM sebagai konteks (PRD §3 Beranda).
 */
export function HeroWrm({
  gmvHariIni,
  gmvKemarin,
  targetHarian,
  keputusan,
  catatan,
  disinkronPada,
}: {
  gmvHariIni: number;
  gmvKemarin: number;
  targetHarian: number;
  keputusan: KeputusanWrm;
  /** Catatan ritme perusahaan; hanya untuk peran yang melihat semua unit. */
  catatan?: string;
  disinkronPada: string;
}) {
  const capaian = rasioCapaian(gmvHariIni, targetHarian);
  const sisa = Math.max(0, targetHarian - gmvHariIni);
  const selisihKemarin =
    gmvKemarin > 0 ? ((gmvHariIni - gmvKemarin) / gmvKemarin) * 100 : 0;
  const naik = selisihKemarin >= 0;
  const gaya = gayaKeputusanWrm[keputusan];

  return (
    <Card className="kartu-interaktif ring-border-subtle rounded-3xl shadow-card">
      <div className="space-y-4 px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            <span className="size-1.5 rounded-full bg-ok" />
            Hari Ini Kita Di Mana?
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold tracking-[0.04em] uppercase",
              gaya.kelas,
            )}
          >
            <span className={cn("size-1.5 rounded-full", gaya.titik)} />
            {gaya.teks}
          </span>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              Total Capaian GMV Hari Ini
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <AngkaBerjalan
                nilai={gmvHariIni}
                format="rupiah"
                digit={2}
                className="tabular text-[26px] leading-8 font-bold tracking-tight sm:text-[28px] sm:leading-9 lg:text-4xl lg:leading-[44px]"
              />
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                  naik
                    ? "bg-ok-fill text-ok-text"
                    : "bg-danger-fill text-danger-text",
                )}
              >
                <TrendingUp
                  className={cn("size-3", !naik && "rotate-180")}
                  strokeWidth={2.5}
                />
                {naik ? "+" : ""}
                {persen(selisihKemarin, 0)}
              </span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              Target Harian
            </p>
            <p className="tabular mt-1 text-[17px] leading-6 font-bold tracking-tight sm:text-[20px] sm:leading-7">
              {rupiahRingkas(targetHarian, { digit: 2, pangkas: false })}
            </p>
          </div>
        </div>

        <BarCapaian
          rasio={capaian}
          label="Capaian GMV terhadap target harian"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] leading-[18px]">
          <span className="text-muted-foreground">
            {persen(capaian)} tercapai per {jamWib(disinkronPada)}
          </span>
          <span className="font-semibold">
            Sisa {rupiahRingkas(sisa, { digit: 2, pangkas: false })}
          </span>
        </div>

        {catatan ? (
          <p className="border-t border-border-subtle pt-3 text-[13px] leading-[18px] text-muted-foreground">
            {catatan}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
