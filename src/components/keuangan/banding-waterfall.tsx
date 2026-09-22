import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas } from "@/lib/format";
import type { RingkasKeuangan } from "@/lib/keuangan";
import { bandingkanWaterfall } from "@/lib/keuangan";

/**
 * Waterfall dengan pembanding periode sebelumnya.
 *
 * Angka satu periode hampir tidak pernah cukup untuk memutuskan apa pun;
 * yang menggerakkan keputusan adalah arah perubahannya. Selisih ditulis
 * dengan tanda, bukan hanya warna, supaya tetap terbaca saat dicetak.
 */
export function BandingWaterfall({
  sekarang,
  sebelumnya,
  labelPembanding,
}: {
  sekarang: RingkasKeuangan;
  sebelumnya: RingkasKeuangan;
  labelPembanding: string;
}) {
  const baris = bandingkanWaterfall(sekarang, sebelumnya);
  const acuan = Math.max(sekarang.pendapatan, sebelumnya.pendapatan, 1);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Waterfall manajemen
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Dibandingkan dengan {labelPembanding}. Aset dan dividen tidak ikut:
          yang satu memindahkan bentuk kekayaan, yang lain memakai laba.
        </p>
      </div>

      <ul className="space-y-2.5 px-5">
        {baris.map((b) => {
          const lebar = Math.min(100, (Math.abs(b.nilai) / acuan) * 100);
          const kurang = b.nilai < 0;
          // Untuk baris pengurang, selisih negatif berarti biayanya turun.
          const membaik = kurang ? b.selisih > 0 : b.selisih > 0;

          return (
            <li key={b.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span
                  className={cn(
                    "text-[13px] leading-[18px]",
                    b.total ? "font-semibold" : "text-muted-foreground",
                  )}
                >
                  {b.label}
                </span>

                <span className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "tabular text-[13px] leading-[18px] font-semibold",
                      kurang ? "text-danger-text" : undefined,
                    )}
                  >
                    {kurang ? "−" : ""}
                    {rupiahRingkas(Math.abs(b.nilai))}
                  </span>
                  {b.selisih !== 0 ? (
                    <span
                      className={cn(
                        "tabular rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
                        membaik
                          ? "bg-ok-fill text-ok-text"
                          : "bg-warn-fill text-warn-text",
                      )}
                    >
                      {b.selisih > 0 ? "+" : "−"}
                      {rupiahRingkas(Math.abs(b.selisih))}
                    </span>
                  ) : null}
                </span>
              </div>

              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    b.total
                      ? "bg-primary"
                      : kurang
                        ? "bg-danger"
                        : "bg-secondary",
                  )}
                  style={{ width: `${lebar}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
