import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BarCapaian } from "@/components/motion/bar-capaian";
import { AngkaBerjalan } from "@/components/motion/angka-berjalan";
import { persen, rupiahRingkas } from "@/lib/format";
import type { GoalKorporasi } from "@/lib/data/grd";

/** Goal korporasi bulan berjalan: base / goal / stretch dan posisinya. */
export function KartuGoalKorporasi({ goal }: { goal: GoalKorporasi }) {
  const sisa = Math.max(0, goal.targetBulan - goal.realisasi);

  const tangga = [
    { label: "Base", nilai: goal.targetBase, gaya: "text-muted-foreground" },
    { label: "Goal (target)", nilai: goal.targetGoal, gaya: "text-secondary" },
    {
      label: "Stretch",
      nilai: goal.targetStretch,
      gaya: "text-muted-foreground",
    },
  ];

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Goal korporasi {goal.periode}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <AngkaBerjalan
              nilai={goal.realisasi}
              format="rupiah"
              digit={0}
              pangkas
              className="tabular text-[26px] leading-8 font-bold tracking-tight lg:text-[32px] lg:leading-10"
            />
            <span className="tabular text-[13px] leading-[18px] text-muted-foreground">
              / {rupiahRingkas(goal.targetBulan)}
            </span>
          </div>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ok-fill text-ok-text">
          <TrendingUp className="size-4" />
        </span>
      </div>

      <div className="space-y-2 px-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] leading-[18px]">
          <span className="flex items-center gap-1.5 font-semibold text-ok-text">
            <span className="size-1.5 rounded-full bg-ok" />
            {persen(goal.rasio)} tercapai
          </span>
          <span className="tabular text-muted-foreground">
            Target sisa {rupiahRingkas(sisa)}
          </span>
        </div>

        <BarCapaian
          rasio={goal.rasio}
          label="Capaian goal korporasi"
          warna="bg-secondary"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-border-subtle px-5 pt-3">
        {tangga.map((t) => (
          <div key={t.label}>
            <p className={`text-[11px] leading-[14px] font-medium ${t.gaya}`}>
              {t.label}
            </p>
            <p className="tabular text-[13px] leading-[18px] font-semibold">
              {rupiahRingkas(t.nilai)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
