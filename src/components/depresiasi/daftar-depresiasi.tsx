import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas } from "@/lib/format";
import type { BarisDepresiasi } from "@/lib/depresiasi";

/**
 * Beban penyusutan per aset, terbesar dulu.
 *
 * Sisa masa manfaat ditampilkan sebagai batang: yang hampir habis
 * berarti bebannya segera berhenti — dan itu kabar yang perlu diketahui
 * sebelum menyusun anggaran periode berikutnya.
 */
export function DaftarDepresiasi({ baris }: { baris: BarisDepresiasi[] }) {
  if (baris.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Tidak ada aset yang menyusut pada periode ini.
        </p>
      </Card>
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <h2 className="px-5 text-base leading-6 font-semibold">
        Penyusutan per aset
      </h2>

      <ul className="space-y-2 px-5">
        {baris.map((b) => {
          const sisa = b.aset.masaManfaat - b.bulanKe;
          const terpakai = (b.bulanKe / b.aset.masaManfaat) * 100;

          return (
            <li key={b.aset.id} className="rounded-2xl bg-muted/50 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div className="min-w-[10rem] flex-1">
                  <p className="text-[13px] leading-[18px] font-semibold text-pretty">
                    <Link
                      href={`/keuangan/depresiasi/${b.aset.kode}`}
                      className="hover:underline"
                    >
                      {b.aset.nama}
                    </Link>
                  </p>
                  <p className="truncate font-mono text-[11px] leading-[14px] text-muted-foreground">
                    {b.aset.kode} · {b.aset.unitNama}
                  </p>
                </div>

                <span className="tabular shrink-0 text-right text-[13px] leading-[18px] font-semibold">
                  −{rupiahRingkas(b.beban)}
                </span>
              </div>

              <div
                className="mt-2 h-1 overflow-hidden rounded-full bg-border-subtle"
                role="img"
                aria-label={`bulan ke-${b.bulanKe} dari ${b.aset.masaManfaat}`}
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    sisa <= 3 ? "bg-warn" : "bg-secondary",
                  )}
                  style={{ width: `${Math.min(100, terpakai)}%` }}
                />
              </div>

              <p className="tabular mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-[14px] text-muted-foreground">
                <span>
                  Bulan ke-{b.bulanKe} dari {b.aset.masaManfaat}
                </span>
                <span
                  className={cn(sisa <= 3 && "font-semibold text-warn-text")}
                >
                  {sisa === 0 ? "berakhir bulan ini" : `sisa ${sisa} bulan`}
                </span>
                <span>nilai buku {rupiahRingkas(b.nilaiBuku)}</span>
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
