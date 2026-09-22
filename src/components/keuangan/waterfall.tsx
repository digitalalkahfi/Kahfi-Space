import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas } from "@/lib/format";
import { waterfallManajemen, type RingkasKeuangan } from "@/lib/keuangan";

/**
 * Waterfall manajemen: dari pendapatan turun ke laba bersih.
 *
 * Batangnya diskalakan terhadap pendapatan, sehingga besar-kecilnya
 * potongan terbaca sekali lihat — itulah gunanya bentuk ini dibanding
 * daftar angka biasa.
 */
export function Waterfall({ ringkas }: { ringkas: RingkasKeuangan }) {
  const baris = waterfallManajemen(ringkas);
  const acuan = Math.max(ringkas.pendapatan, 1);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Waterfall manajemen
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Aset dan dividen tidak ikut: yang satu memindahkan bentuk kekayaan,
          yang lain memakai laba yang sudah jadi.
        </p>
      </div>

      <ul className="space-y-2 px-5">
        {baris.map((b) => {
          const lebar = Math.min(100, (Math.abs(b.nilai) / acuan) * 100);
          const kurang = b.nilai < 0;

          return (
            <li key={b.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={cn(
                    "text-[13px] leading-[18px]",
                    b.total ? "font-semibold" : "text-muted-foreground",
                  )}
                >
                  {b.label}
                </span>
                <span
                  className={cn(
                    "tabular text-[13px] leading-[18px] font-semibold",
                    kurang ? "text-danger-text" : undefined,
                  )}
                >
                  {kurang ? "−" : ""}
                  {rupiahRingkas(Math.abs(b.nilai))}
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
