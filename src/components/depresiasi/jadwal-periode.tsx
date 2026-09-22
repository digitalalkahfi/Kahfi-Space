import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bulanPendek, rupiahRingkas } from "@/lib/format";
import type { BarisPeriode } from "@/lib/depresiasi";

/**
 * Beban penyusutan periode demi periode, beberapa bulan ke belakang dan
 * ke depan.
 *
 * Bulan yang belum terjadi ditandai sebagai ramalan — angkanya memang
 * sudah pasti, jadwalnya ditetapkan sejak aset dicatat, tetapi
 * menyebutnya realisasi akan keliru.
 */
export function JadwalPeriode({
  baris,
  periodeAktif,
}: {
  baris: BarisPeriode[];
  periodeAktif: string;
}) {
  if (baris.length === 0) return null;

  const puncak = Math.max(1, ...baris.map((b) => b.beban));

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Jadwal penyusutan per periode
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Tiga bulan ke belakang dan ke depan. Beban yang turun berarti ada aset
          yang masa manfaatnya habis — penggantinya perlu dianggarkan.
        </p>
      </div>

      <ul className="space-y-2.5 px-5">
        {baris.map((b) => (
          <li key={b.periode}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span
                className={cn(
                  "text-[13px] leading-[18px]",
                  b.periode === periodeAktif
                    ? "font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {bulanPendek(b.periode)}
                {b.ramalan ? (
                  <span className="ml-1.5 text-[11px] leading-[14px] text-muted-foreground">
                    ramalan
                  </span>
                ) : null}
              </span>

              <span className="tabular text-[13px] leading-[18px] font-semibold">
                −{rupiahRingkas(b.beban)}
              </span>
            </div>

            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  b.ramalan
                    ? "bg-secondary/50"
                    : b.periode === periodeAktif
                      ? "bg-primary"
                      : "bg-secondary",
                )}
                style={{ width: `${(b.beban / puncak) * 100}%` }}
              />
            </div>

            <p className="tabular mt-1 text-[11px] leading-[14px] text-muted-foreground">
              {b.jumlahAset} aset menyusut · akumulasi{" "}
              {rupiahRingkas(b.akumulasi)}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
