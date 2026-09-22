import { CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BarCapaian } from "@/components/motion/bar-capaian";
import { cn } from "@/lib/utils";
import { persen, rupiahRingkas } from "@/lib/format";
import type { AnakTanggaBulan } from "@/lib/data/goal";

const NAMA_BULAN = (b: string) =>
  new Date(`${b}T00:00:00Z`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** Anak tangga bulanan: target dipecah per bulan, bukan satu angka besar. */
export function TanggaBulanan({
  judul,
  bulan,
}: {
  judul: string;
  bulan: AnakTanggaBulan[];
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Anak tangga bulanan
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {judul}
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <CalendarRange className="size-4" />
        </span>
      </div>

      {bulan.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Goal ini belum dipecah per bulan.
        </p>
      ) : (
        <ol className="space-y-2.5 px-5">
          {bulan.map((b) => {
            const mendatang = b.realisasi === 0 && !b.berjalan;
            const kuat = b.rasio >= 90;
            return (
              <li
                key={b.bulan}
                className={cn(
                  "baris-interaktif rounded-2xl p-3.5",
                  b.berjalan ? "bg-info-fill" : "bg-muted/50",
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm leading-5 font-semibold">
                    {NAMA_BULAN(b.bulan)}
                    {b.berjalan ? (
                      <span className="ml-1.5 rounded-full bg-card px-2 py-0.5 text-[10px] leading-[13px] font-semibold text-info-text">
                        Berjalan
                      </span>
                    ) : null}
                  </p>
                  <p className="tabular text-[13px] leading-[18px]">
                    <span className="font-semibold">
                      {mendatang ? "—" : rupiahRingkas(b.realisasi)}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      / {rupiahRingkas(b.target)}
                    </span>
                  </p>
                </div>

                {mendatang ? (
                  <p className="mt-1.5 text-[11px] leading-[14px] text-muted-foreground">
                    Belum berjalan.
                  </p>
                ) : (
                  <>
                    <BarCapaian
                      rasio={b.rasio}
                      label={`Capaian ${NAMA_BULAN(b.bulan)}`}
                      warna={kuat ? "bg-ok" : "bg-warn"}
                      tinggi="h-1.5"
                      className="mt-2.5 bg-card"
                    />
                    <p
                      className={cn(
                        "tabular mt-1.5 text-[11px] leading-[14px] font-semibold",
                        kuat ? "text-ok-text" : "text-warn-text",
                      )}
                    >
                      {persen(b.rasio)} dari anak tangga bulan ini
                    </p>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
