import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Network,
  TrendingUp,
  Tv,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { jamWib, persen, rasioCapaian, rupiahRingkas } from "@/lib/format";
import { gayaUnit } from "@/lib/unit";
import { BarCapaian } from "@/components/motion/bar-capaian";
import type { CapaianUnit, KodeUnit } from "@/lib/types";

const ikonUnit: Record<KodeUnit, typeof Users> = {
  affiliator: Users,
  mcn: Tv,
  tap: Network,
};

/**
 * GMV hari ini DAN kemarin dibanding target, untuk tiga pilar operasional
 * (PRD §3 Beranda — "GMV vs Target"). Angka kemarin muncul dua kali:
 * sebagai selisih persen di baris nilai, dan sebagai garis pembanding di bar.
 */
export function GmvPerUnit({
  unit,
  disinkronPada,
}: {
  unit: CapaianUnit[];
  disinkronPada: string;
}) {
  const totalGmv = unit.reduce((a, u) => a + u.gmv, 0);
  const totalTarget = unit.reduce((a, u) => a + u.target, 0);
  const totalKemarin = unit.reduce((a, u) => a + u.gmvKemarin, 0);
  const selisihTotal =
    totalKemarin > 0 ? ((totalGmv - totalKemarin) / totalKemarin) * 100 : 0;

  return (
    <Card className="kartu-interaktif ring-border-subtle rounded-3xl shadow-card">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            GMV vs Target per Unit Hari Ini
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Hari ini vs kemarin per lini bisnis, sampai {jamWib(disinkronPada)}
          </p>
        </div>
        <span
          className={cn(
            "tabular hidden shrink-0 rounded-full px-3 py-1.5 text-xs leading-4 font-semibold sm:inline-block",
            selisihTotal >= 0
              ? "bg-ok-fill text-ok-text"
              : "bg-danger-fill text-danger-text",
          )}
        >
          Total: {rupiahRingkas(totalGmv)} / {rupiahRingkas(totalTarget)}
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle sm:hidden">
          <BarChart3 className="size-4" />
        </span>
      </div>

      <ul className="space-y-3 px-5">
        {unit.map((u) => {
          const rasio = rasioCapaian(u.gmv, u.target);
          const rasioKemarin = rasioCapaian(u.gmvKemarin, u.target);
          const sisa = Math.max(0, u.target - u.gmv);
          const selisih =
            u.gmvKemarin > 0
              ? ((u.gmv - u.gmvKemarin) / u.gmvKemarin) * 100
              : 0;
          const naik = selisih >= 0;
          const Icon = ikonUnit[u.unitId];
          const gaya = gayaUnit[u.unitId];

          return (
            <li
              key={u.unitId}
              className="baris-interaktif rounded-2xl bg-muted/60 p-3.5 sm:bg-transparent sm:p-0 sm:hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full sm:size-7",
                      gaya.latar,
                      gaya.teks,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm leading-5 font-semibold text-pretty">
                      {u.nama}
                    </span>
                    <span className="block text-[11px] leading-[14px] text-muted-foreground">
                      {u.keterangan}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular block text-sm leading-5 font-bold">
                    {rupiahRingkas(u.gmv)}
                  </span>
                  <span className="tabular block text-[11px] leading-[14px] text-muted-foreground">
                    / {rupiahRingkas(u.target)}
                  </span>
                </span>
              </div>

              <BarCapaian
                rasio={rasio}
                label={`Capaian ${u.nama}`}
                warna={gaya.bar}
                tinggi="h-1.5"
                penanda={{
                  rasio: rasioKemarin,
                  label: `Kemarin ${rupiahRingkas(u.gmvKemarin)} (${persen(rasioKemarin)} dari target)`,
                }}
                className="mt-2.5 bg-border-subtle"
              />

              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] leading-[14px]">
                <span className="flex items-center gap-1.5">
                  <span className={cn("font-semibold", gaya.teks)}>
                    {persen(rasio)} dari target
                  </span>
                  <span
                    className={cn(
                      "tabular inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] leading-[13px] font-semibold",
                      naik
                        ? "bg-ok-fill text-ok-text"
                        : "bg-danger-fill text-danger-text",
                    )}
                  >
                    <TrendingUp
                      className={cn("size-2.5", !naik && "rotate-180")}
                      strokeWidth={2.5}
                    />
                    {naik ? "+" : ""}
                    {persen(selisih, 0)}
                  </span>
                </span>
                <span className="tabular text-muted-foreground">
                  Kemarin {rupiahRingkas(u.gmvKemarin)} · sisa{" "}
                  {rupiahRingkas(sisa)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-border-subtle px-5 pt-3 text-[11px] leading-[14px] sm:text-[13px] sm:leading-[18px]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-3 w-0.5 shrink-0 rounded-full bg-foreground/35" />
          Garis = posisi kemarin ({rupiahRingkas(totalKemarin)})
        </span>
        <Link
          href="/gmv"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1 font-semibold text-secondary hover:underline"
        >
          Lihat rekapitulasi
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}
