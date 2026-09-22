import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas } from "@/lib/format";
import { jadwalPenyusutan, type Aset } from "@/lib/aset";

/**
 * Jadwal penyusutan per tahun.
 *
 * Yang ditanyakan sebelum membeli pengganti selalu sama: "tahun berapa
 * barang ini habis nilainya". Tabel ini menjawabnya tanpa perlu ada yang
 * menghitung manual di spreadsheet terpisah.
 */
export function JadwalPenyusutan({
  aset,
  sampai,
}: {
  aset: Aset;
  /** Tahun berjalan ditandai supaya mudah ditemukan. */
  sampai: string;
}) {
  const baris = jadwalPenyusutan(aset);
  if (baris.length === 0) return null;

  const tahunIni = Number(sampai.slice(0, 4));

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Jadwal penyusutan</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Garis lurus {aset.masaManfaat} bulan sejak perolehan, berhenti di
          nilai residu.
        </p>
      </div>

      <div className="px-5">
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="tabular w-full min-w-[18rem] border-collapse text-[13px] leading-[18px]">
            <thead>
              <tr className="text-[11px] leading-[14px] text-muted-foreground">
                <th scope="col" className="py-2 text-left font-medium">
                  Tahun
                </th>
                <th
                  scope="col"
                  className="hidden py-2 text-right font-medium sm:table-cell"
                >
                  Bulan
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
              {baris.map((b) => (
                <tr
                  key={b.tahun}
                  className={cn(
                    "border-t border-border-subtle",
                    b.tahun === tahunIni && "bg-muted/50",
                  )}
                >
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                    {b.tahun}
                    {b.tahun === tahunIni ? (
                      <span className="ml-1.5 text-[11px] leading-[14px] font-normal text-muted-foreground">
                        berjalan
                      </span>
                    ) : null}
                  </th>
                  <td className="hidden py-2.5 text-right text-muted-foreground sm:table-cell">
                    {b.bulan}
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground">
                    −{rupiahRingkas(b.beban)}
                  </td>
                  <td className="py-2.5 text-right font-semibold">
                    {rupiahRingkas(b.nilaiAkhir)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
