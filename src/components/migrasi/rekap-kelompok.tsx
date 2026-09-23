import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bilangan } from "@/lib/format";
import { totalRekap, type BarisRekapKelompok } from "@/lib/rekap-pemetaan";

/**
 * Rekap per kelompok: berapa ada, berapa siap, berapa menunggu orang.
 *
 * Kolom ketiga yang paling penting dan paling gampang tidak ditampilkan.
 * Entri yang menunjuk orang tak dikenal bisa saja dipaksa masuk dengan
 * penunjuk kosong — hasilnya data yang tampak utuh, lengkap dengan
 * jumlah barisnya yang cocok, tetapi laporannya tidak punya pelapor dan
 * tugasnya tidak punya penerima.
 */
export function RekapKelompok({ baris }: { baris: BarisRekapKelompok[] }) {
  const total = totalRekap(baris);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Rekap per kelompok
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {bilangan(total.ekspor)} entri di ekspor ·{" "}
          {bilangan(total.terpetakan)} siap dipetakan ·{" "}
          {bilangan(total.dipindahkan)} sudah punya padanan di V2 ·{" "}
          {bilangan(total.butuhKeputusan)} menunggu keputusan
          {total.orangHilang.length > 0
            ? ` (${total.orangHilang.length} orang belum tertaut)`
            : ""}
          .
        </p>
      </div>

      <div className="px-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[24rem] border-collapse">
            <thead>
              <tr className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                <th className="py-1.5 text-left">Kelompok</th>
                <th className="py-1.5 text-right">Ekspor</th>
                <th className="py-1.5 text-right">Terpetakan</th>
                <th className="py-1.5 text-right">Sudah pindah</th>
                <th className="py-1.5 text-right">Butuh keputusan</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr
                  key={b.kunci}
                  className="border-t border-border-subtle align-top"
                >
                  <td className="py-2 pr-3">
                    <span className="block text-[13px] leading-[18px] font-semibold">
                      {b.label}
                    </span>
                    <span className="block font-mono text-[11px] leading-[14px] break-all text-muted-foreground">
                      {b.kunci}
                    </span>
                    {b.orangHilang.length > 0 ? (
                      <span className="mt-0.5 block text-[11px] leading-[14px] text-pretty text-muted-foreground">
                        Menunggu:{" "}
                        <span className="font-mono">
                          {b.orangHilang.slice(0, 6).join(", ")}
                        </span>
                        {b.orangHilang.length > 6
                          ? ` dan ${b.orangHilang.length - 6} lainnya`
                          : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="tabular py-2 text-right text-[13px] leading-[18px]">
                    {bilangan(b.ekspor)}
                  </td>
                  <td className="tabular py-2 text-right text-[13px] leading-[18px]">
                    {bilangan(b.terpetakan)}
                  </td>
                  <td className="tabular py-2 text-right text-[13px] leading-[18px]">
                    {bilangan(b.dipindahkan)}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <span
                      className={cn(
                        "tabular inline-flex rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
                        b.butuhKeputusan > 0
                          ? "bg-warn-fill text-warn-text"
                          : "bg-ok-fill text-ok-text",
                      )}
                    >
                      {bilangan(b.butuhKeputusan)}
                    </span>
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
