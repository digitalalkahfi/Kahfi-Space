import { Activity, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BarCapaian } from "@/components/motion/bar-capaian";
import { cn } from "@/lib/utils";
import { persen } from "@/lib/format";
import { gayaUnit } from "@/lib/unit";
import type { PapanLead } from "@/lib/data/grd";

const ANGKA = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/** Papan skor langkah kunci pekan berjalan (leading indicator). */
export function PapanLeadMeasure({ papan }: { papan: PapanLead[] }) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Lead measure mingguan
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Langkah kunci yang menentukan capaian GMV
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <Activity className="size-4" />
        </span>
      </div>

      {papan.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada lead measure aktif untuk pekan ini.
        </p>
      ) : (
        <ul className="space-y-2.5 px-5">
          {papan.map((m) => {
            const gaya = m.unit ? gayaUnit[m.unit] : null;
            const kuat = m.rasio >= 90;
            return (
              <li
                key={m.id}
                className={cn(
                  "baris-interaktif rounded-2xl p-3.5",
                  gaya?.latar ?? "bg-muted/60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm leading-5 font-semibold">{m.judul}</p>
                    <p className="tabular text-[11px] leading-[14px] text-muted-foreground">
                      {ANGKA.format(m.realisasi)} dari {ANGKA.format(m.target)}{" "}
                      {m.satuan}
                      {m.labelPendukung && m.pendukung !== null
                        ? ` · ${m.labelPendukung}: ${ANGKA.format(m.pendukung)}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "tabular shrink-0 text-[13px] leading-[18px] font-bold",
                      kuat ? gaya?.teks : "text-danger-text",
                    )}
                  >
                    {persen(m.rasio)}
                  </span>
                </div>

                <BarCapaian
                  rasio={m.rasio}
                  label={`Capaian ${m.judul}`}
                  warna={kuat ? (gaya?.bar ?? "bg-primary") : "bg-danger"}
                  tinggi="h-1.5"
                  className="mt-2.5 bg-card"
                />
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-center gap-1.5 border-t border-border-subtle px-5 pt-3 text-[11px] leading-[14px] text-muted-foreground">
        <ArrowUpRight className="size-3 shrink-0" />
        Diisi harian oleh unit; yang dihitung capaian pekan berjalan.
      </p>
    </Card>
  );
}
