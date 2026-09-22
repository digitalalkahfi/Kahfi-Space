import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas } from "@/lib/format";
import type { BarisLaporan } from "@/lib/keuangan";

/**
 * Satu laporan keuangan sebagai daftar baris.
 *
 * Angka pengurang ditulis dengan tanda minus yang jelas, bukan hanya
 * diberi warna: laporan keuangan sering dibaca ulang dalam cetakan
 * hitam-putih.
 */
export function TabelLaporan({
  judul,
  keterangan,
  baris,
}: {
  judul: string;
  keterangan: string;
  baris: BarisLaporan[];
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">{judul}</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {keterangan}
        </p>
      </div>

      <dl className="px-5">
        {baris.map((b) => (
          <div
            key={b.label}
            className={cn(
              "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border-subtle py-2 last:border-b-0",
              b.total && "bg-muted/40 -mx-2 rounded-xl px-2",
            )}
          >
            <dt
              className={cn(
                "text-[13px] leading-[18px]",
                b.total ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {b.label}
              {b.catatan ? (
                <span className="block text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  {b.catatan}
                </span>
              ) : null}
            </dt>
            <dd
              className={cn(
                "tabular text-[13px] leading-[18px] font-semibold",
                b.nilai < 0 ? "text-danger-text" : undefined,
              )}
            >
              {b.nilai < 0 ? "−" : ""}
              {rupiahRingkas(Math.abs(b.nilai))}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
