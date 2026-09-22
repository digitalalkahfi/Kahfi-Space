import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bulanPendek, rupiahRingkas } from "@/lib/format";
import {
  GAYA_STATUS_ANGGARAN,
  rekapDivisi,
  totalDivisi,
  type Anggaran,
  type SelDivisi,
} from "@/lib/budget";
import type { Transaksi } from "@/lib/keuangan";

function Sel({ isi, tebal = false }: { isi: SelDivisi; tebal?: boolean }) {
  if (isi.anggaran === 0 && isi.realisasi === 0) {
    return <td className="py-2.5 text-right text-muted-foreground/60">—</td>;
  }

  return (
    <td className="py-2.5 text-right">
      <span className={cn("block", tebal && "font-semibold")}>
        {rupiahRingkas(isi.realisasi)}
      </span>
      <span className="block text-[11px] leading-[14px] text-muted-foreground">
        dari {rupiahRingkas(isi.anggaran)}
      </span>
      <span
        className={cn(
          "mt-0.5 inline-flex rounded-full px-1.5 text-[10px] leading-[14px] font-semibold",
          GAYA_STATUS_ANGGARAN[isi.status],
        )}
      >
        {Math.round(isi.rasio)}%
      </span>
    </td>
  );
}

/**
 * Anggaran per divisi × periode.
 *
 * Daftar per pos menjawab "pos mana yang jebol"; tabel ini menjawab
 * pertanyaan yang lain — "divisi mana yang belanjanya memburuk dari
 * bulan ke bulan". Karena itu periode berjajar sebagai kolom, bukan
 * disaring satu per satu.
 */
export function TabelDivisi({
  anggaran,
  transaksi,
  periode,
}: {
  anggaran: Anggaran[];
  transaksi: Transaksi[];
  /** Periode yang ditampilkan sebagai kolom, terbaru dulu. */
  periode: string[];
}) {
  const baris = rekapDivisi(anggaran, transaksi, periode);
  if (baris.length === 0) return null;

  const total = totalDivisi(baris, periode);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Anggaran per divisi
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Realisasi dibanding pagunya, berjajar antar periode — supaya arah
          belanja tiap divisi terbaca, bukan cuma posisi bulan ini.
        </p>
      </div>

      <div className="px-5">
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="tabular w-full min-w-[22rem] border-collapse text-[13px] leading-[18px]">
            <thead>
              <tr className="text-[11px] leading-[14px] text-muted-foreground">
                <th scope="col" className="py-2 text-left font-medium">
                  Divisi
                </th>
                {periode.map((p) => (
                  <th
                    key={p}
                    scope="col"
                    className="py-2 text-right font-medium"
                  >
                    {bulanPendek(p)}
                  </th>
                ))}
                <th scope="col" className="py-2 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {baris.map((b) => (
                <tr key={b.unitNama} className="border-t border-border-subtle">
                  <th
                    scope="row"
                    className="py-2.5 pr-3 text-left font-medium text-pretty"
                  >
                    {b.unitNama}
                  </th>
                  {periode.map((p) => (
                    <Sel key={p} isi={b.perPeriode[p]} />
                  ))}
                  <Sel isi={b.total} tebal />
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="border-t border-border">
                <th scope="row" className="py-2.5 pr-3 text-left font-semibold">
                  {total.unitNama}
                </th>
                {periode.map((p) => (
                  <Sel key={p} isi={total.perPeriode[p]} tebal />
                ))}
                <Sel isi={total.total} tebal />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Card>
  );
}
