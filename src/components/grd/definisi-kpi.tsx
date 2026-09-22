import { Gauge, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AksiIndikatorKpi } from "@/components/grd/aksi-indikator-kpi";
import { cn } from "@/lib/utils";
import { persen } from "@/lib/format";
import { LABEL_SUMBER, type DefinisiKpi } from "@/lib/kpi";

const ANGKA = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/**
 * Definisi KPI satu jabatan.
 *
 * Bobot ditampilkan berikut totalnya: kalau tidak berjumlah 100, penilaian
 * jadi timpang — dan itu harus terlihat, bukan tersembunyi.
 */
export function DefinisiKpiJabatan({
  jabatan,
  indikator,
  totalBobot,
  kelola = false,
}: {
  jabatan: string;
  indikator: DefinisiKpi[];
  totalBobot: number;
  /** CEO/Manager boleh menyalakan-matikan indikator dari kartu ini. */
  kelola?: boolean;
}) {
  const bobotSeimbang = Math.abs(totalBobot - 100) < 0.01;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">{jabatan}</h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {indikator.length} indikator · skala{" "}
            {ANGKA.format(indikator[0]?.skala ?? 1000)}
          </p>
        </div>
        <span
          className={cn(
            "tabular flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
            bobotSeimbang
              ? "bg-ok-fill text-ok-text"
              : "bg-danger-fill text-danger-text",
          )}
          title={
            bobotSeimbang
              ? "Bobot berjumlah 100%"
              : "Bobot tidak berjumlah 100% — penilaian akan timpang"
          }
        >
          <Scale className="size-3" />
          {persen(totalBobot, 0)}
        </span>
      </div>

      <ul className="space-y-2 px-5">
        {indikator.map((k) => (
          <li
            key={k.id}
            className={cn(
              "baris-interaktif rounded-2xl p-3.5",
              k.aktif ? "bg-muted/60" : "bg-muted/30",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm leading-5 font-semibold">{k.namaKpi}</p>
                <p className="flex items-center gap-1 text-[11px] leading-[14px] text-muted-foreground">
                  <Gauge className="size-3 shrink-0" />
                  {LABEL_SUMBER[k.sumberData]} · {k.periode}
                </p>
              </div>
              <span
                className={cn(
                  "tabular shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                  k.aktif
                    ? "bg-card"
                    : "bg-card text-muted-foreground line-through",
                )}
              >
                bobot {persen(k.bobot, 0)}
              </span>
            </div>

            <dl className="tabular mt-2 grid grid-cols-3 gap-2 text-[11px] leading-[14px]">
              {[
                { t: "Base → 500", v: k.targetBase },
                { t: "Goal → 800", v: k.targetGoal },
                { t: "Stretch → 1.000", v: k.targetStretch },
              ].map((x) => (
                <div key={x.t} className="rounded-xl bg-card px-2 py-1.5">
                  <dt className="text-muted-foreground">{x.t}</dt>
                  <dd className="font-semibold">
                    {ANGKA.format(x.v)} {k.satuan}
                  </dd>
                </div>
              ))}
            </dl>

            {kelola ? (
              <AksiIndikatorKpi indikatorId={k.id} aktif={k.aktif} />
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
