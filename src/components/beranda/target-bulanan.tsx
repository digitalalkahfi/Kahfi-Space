import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rasioCapaian, rupiahRingkas } from "@/lib/format";
import { gayaUnit } from "@/lib/unit";
import { DonutCapaian } from "@/components/beranda/donut-capaian";
import type { CapaianUnit } from "@/lib/types";

const R = 54;
const KELILING = 2 * Math.PI * R;

/** Donut akumulasi GMV bulan berjalan, dipecah per unit pelaporan. */
export function TargetBulanan({
  unit,
  targetBulanan,
  sisaHari,
}: {
  unit: CapaianUnit[];
  targetBulanan: number;
  sisaHari: number;
}) {
  const total = unit.reduce((akum, u) => akum + u.gmvBulanIni, 0);
  const capaian = rasioCapaian(total, targetBulanan);

  // Tiap segmen digeser sepanjang akumulasi segmen sebelumnya (prefix sum).
  const segmen = unit.reduce<
    { unit: CapaianUnit; panjang: number; offset: number }[]
  >((kumpulan, u) => {
    const porsi = targetBulanan > 0 ? u.gmvBulanIni / targetBulanan : 0;
    const panjang = Math.min(porsi, 1) * KELILING;
    const sebelumnya = kumpulan.at(-1);
    const offset = sebelumnya ? sebelumnya.offset + sebelumnya.panjang : 0;
    return [...kumpulan, { unit: u, panjang, offset }];
  }, []);

  return (
    <Card className="kartu-interaktif ring-border-subtle rounded-3xl shadow-card">
      <div className="flex items-start justify-between px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Target GMV Bulan Ini
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Akumulasi target {rupiahRingkas(targetBulanan)}
          </p>
        </div>
        {/* Rincian bulan berjalan ada di dasbor Analitik GMV; tombol ini
            dulu tidak menuju ke mana-mana. */}
        <Link
          href="/gmv?periode=bulanan"
          aria-label="Buka rincian target bulanan di Analitik GMV"
          className="tekan-halus sentuh-nyaman flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground"
        >
          <ArrowUpRight className="size-4" />
        </Link>
      </div>

      <div className="flex flex-col items-center gap-5 px-5 sm:flex-row sm:gap-6">
        <DonutCapaian
          segmen={segmen.map((x) => ({
            kunci: x.unit.unitId,
            panjang: x.panjang,
            offset: x.offset,
            garis: gayaUnit[x.unit.unitId].garis,
          }))}
          keliling={KELILING}
          radius={R}
          capaian={capaian}
        />

        <ul className="w-full space-y-2">
          {unit.map((u) => (
            <li
              key={u.unitId}
              className={cn(
                "baris-interaktif flex items-center justify-between gap-3 rounded-xl px-3 py-2.5",
                gayaUnit[u.unitId].latar,
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    gayaUnit[u.unitId].titik,
                  )}
                />
                <span className="truncate text-[13px] leading-[18px] font-medium">
                  {u.namaPendek}
                </span>
              </span>
              <span
                className={cn(
                  "tabular shrink-0 text-[13px] leading-[18px] font-semibold",
                  gayaUnit[u.unitId].teks,
                )}
              >
                {rupiahRingkas(u.gmvBulanIni)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between border-t border-border-subtle px-5 pt-3 text-[13px] leading-[18px]">
        <span className="text-muted-foreground">
          Terkumpul {rupiahRingkas(total)}
        </span>
        <span className="font-semibold">Sisa {sisaHari} hari</span>
      </div>
    </Card>
  );
}
