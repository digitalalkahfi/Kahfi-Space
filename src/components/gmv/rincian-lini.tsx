import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen, rasioCapaian, rupiahRingkas } from "@/lib/format";
import { gayaUnit } from "@/lib/unit";
import type { SeriUnit } from "@/lib/gmv";

/**
 * Rincian per lini bisnis.
 *
 * Grafik gabungan menjawab "lini mana yang bergerak"; tabel ini
 * menjawab "sebesar apa". Keduanya perlu — garis yang menurun tidak
 * berguna bagi orang yang harus menyebutkan angkanya dalam rapat.
 *
 * Porsi dihitung terhadap total periode, bukan terhadap target: yang
 * ditanyakan di baris ini adalah komposisi, dan komposisi terhadap
 * target bukan komposisi.
 */
export function RincianLini({
  seri,
  total,
}: {
  seri: SeriUnit[];
  /** Total seluruh lini pada periode yang sama. */
  total: number;
}) {
  if (seri.length === 0) return null;

  const urut = [...seri].sort((a, b) => b.total - a.total);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-2 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Rincian per lini
          </h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Angka di balik tiap garis. Rata-rata dihitung dari hari yang lini
            itu benar-benar melapor, bukan dari panjang periodenya.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                {["Lini", "Total", "Porsi", "Rata-rata", "Tertinggi"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={cn(
                        "py-2 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase",
                        i === 0 ? "pr-3" : "pr-3 text-right",
                        i === 4 && "pr-0",
                      )}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {urut.map((s) => {
                const porsi = total > 0 ? rasioCapaian(s.total, total) : 0;
                const gaya = gayaUnit[s.unitId];
                return (
                  <tr
                    key={s.unitId}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={cn(
                            "h-0.5 w-4 shrink-0 rounded-full",
                            gaya.bar,
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold">{s.nama}</span>
                          <span className="block text-[11px] leading-[14px] text-muted-foreground">
                            {s.hariTerlapor} hari terlapor
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="tabular py-2 pr-3 text-right font-semibold">
                      {rupiahRingkas(s.total)}
                    </td>
                    <td className="tabular py-2 pr-3 text-right text-muted-foreground">
                      {persen(porsi, 0)}
                    </td>
                    <td className="tabular py-2 pr-3 text-right text-muted-foreground">
                      {rupiahRingkas(s.rataRata)}
                    </td>
                    <td className="tabular py-2 text-right">
                      {s.tertinggi ? (
                        <>
                          {rupiahRingkas(s.tertinggi.nilai)}
                          <span className="block text-[11px] leading-[14px] text-muted-foreground">
                            {s.tertinggi.label}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
