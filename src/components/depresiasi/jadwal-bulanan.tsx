import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bulanPendek, rupiahRingkas } from "@/lib/format";
import { jadwalBulanan } from "@/lib/depresiasi";
import type { Aset } from "@/lib/aset";

/**
 * Jadwal penyusutan bulan demi bulan untuk satu aset.
 *
 * Kartu aset menampilkannya per tahun — cukup untuk membaca umurnya.
 * Tabel ini per bulan, karena itulah satuan yang dipakai pembukuan saat
 * mencatat bebannya.
 */
export function JadwalBulanan({
  aset,
  periodeBerjalan,
}: {
  aset: Aset;
  /** Periode "2024-10" yang sedang dibuka; ditandai di tabel. */
  periodeBerjalan: string;
}) {
  const baris = jadwalBulanan(aset);

  if (baris.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Aset ini tidak disusutkan — masa manfaatnya nol.
        </p>
      </Card>
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Jadwal penyusutan bulanan
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Garis lurus {aset.masaManfaat} bulan sejak perolehan, berhenti di
          nilai residu {rupiahRingkas(aset.residu)}.
        </p>
      </div>

      <div className="px-5">
        <div className="-mx-1 max-h-[26rem] overflow-auto px-1">
          <table className="tabular w-full min-w-[20rem] border-collapse text-[13px] leading-[18px]">
            <thead className="sticky top-0 bg-card">
              <tr className="text-[11px] leading-[14px] text-muted-foreground">
                <th scope="col" className="py-2 text-left font-medium">
                  Bulan
                </th>
                <th
                  scope="col"
                  className="hidden py-2 text-right font-medium sm:table-cell"
                >
                  Ke-
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Beban
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Nilai akhir
                </th>
              </tr>
            </thead>

            <tbody>
              {baris.map((b) => {
                const berjalan = b.periode === periodeBerjalan;
                return (
                  <tr
                    key={b.periode}
                    className={cn(
                      "border-t border-border-subtle",
                      berjalan && "bg-muted/50",
                    )}
                  >
                    <th
                      scope="row"
                      className="py-2.5 pr-3 text-left font-medium"
                    >
                      {bulanPendek(b.periode)}
                      {berjalan ? (
                        <span className="ml-1.5 text-[11px] leading-[14px] font-normal text-muted-foreground">
                          berjalan
                        </span>
                      ) : null}
                    </th>
                    <td className="hidden py-2.5 text-right text-muted-foreground sm:table-cell">
                      {b.bulanKe}
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground">
                      −{rupiahRingkas(b.beban)}
                    </td>
                    <td className="py-2.5 text-right font-semibold">
                      {rupiahRingkas(b.nilaiAkhir)}
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
