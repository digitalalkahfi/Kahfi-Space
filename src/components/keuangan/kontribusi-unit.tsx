import { Card } from "@/components/ui/card";
import { persen, rupiahRingkas } from "@/lib/format";
import type { KontribusiUnit } from "@/lib/keuangan";

/**
 * Kontribusi tiap unit terhadap net revenue.
 *
 * Beban perusahaan sengaja tidak dibagi ke unit: membaginya menghasilkan
 * angka yang terasa pasti padahal dasarnya pilihan sewenang-wenang.
 */
export function KontribusiUnitKartu({ daftar }: { daftar: KontribusiUnit[] }) {
  if (daftar.length === 0) return null;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Kontribusi unit</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Net revenue yang benar-benar melekat pada tiap unit — beban perusahaan
          tidak dibagi-bagi ke sini.
        </p>
      </div>

      <ul className="space-y-2 px-5">
        {daftar.map((u) => (
          <li key={u.unitNama} className="rounded-2xl bg-muted/50 p-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[13px] leading-[18px] font-semibold">
                {u.unitNama}
              </span>
              <span className="tabular text-[13px] leading-[18px] font-semibold">
                {rupiahRingkas(u.netRevenue)}
                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                  {persen(u.porsi)}
                </span>
              </span>
            </div>

            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-card">
              <div
                className="h-full rounded-full bg-secondary"
                style={{ width: `${Math.max(0, Math.min(100, u.porsi))}%` }}
              />
            </div>

            <p className="tabular mt-1 text-[11px] leading-[14px] text-muted-foreground">
              Pendapatan {rupiahRingkas(u.pendapatan)}
              {u.directCost > 0
                ? ` · direct cost ${rupiahRingkas(u.directCost)}`
                : ""}
              {u.creatorShare > 0
                ? ` · creator share ${rupiahRingkas(u.creatorShare)}`
                : ""}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
