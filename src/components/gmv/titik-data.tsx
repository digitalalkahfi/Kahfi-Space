import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen, rupiahRingkas } from "@/lib/format";
import { rasioCapaian } from "@/lib/format";
import type { TitikGmv } from "@/lib/gmv";

/**
 * Daftar angka penyusun grafik.
 *
 * Grafik memberi bentuk, tabel memberi angka. Keduanya perlu: garis yang
 * menurun tidak berguna bagi orang yang harus menjelaskan hari mana yang
 * turun dan berapa banyak.
 */
export function TitikData({ titik }: { titik: TitikGmv[] }) {
  const terbaruDulu = [...titik].reverse();

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-2 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">Rincian harian</h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Angka penyusun grafik, terbaru lebih dulu. Buka sebuah tanggal untuk
            melihat laporan mana saja yang menyusunnya. Hari tanpa laporan tidak
            muncul di sini — dan memang tidak dihitung sebagai nol.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="py-2 pr-3 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  Tanggal
                </th>
                <th className="py-2 pr-3 text-right text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  GMV
                </th>
                <th className="py-2 pr-3 text-right text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  Target
                </th>
                <th className="py-2 text-right text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  Capaian
                </th>
              </tr>
            </thead>
            <tbody>
              {terbaruDulu.map((t) => {
                const rasio = rasioCapaian(t.gmv, t.target);
                return (
                  <tr
                    key={t.tanggal}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <td className="py-2 pr-3">
                      {/* Bisa dibuka untuk melihat siapa saja yang
                          menyusun angka hari itu — "kenapa Rabu turun"
                          tidak bisa dijawab oleh satu angka gabungan.
                          Memakai <details> supaya tetap jalan tanpa
                          JavaScript dan tanpa menambah state. */}
                      <details className="group/rinci">
                        <summary className="tekan-halus cursor-pointer list-none">
                          {t.label}
                          <span className="flex items-center gap-1 text-[11px] leading-[14px] text-muted-foreground">
                            <ChevronRight className="size-3 transition-transform group-open/rinci:rotate-90" />
                            {t.jumlahLaporan} laporan
                          </span>
                        </summary>
                        <ul className="mt-1 space-y-0.5 border-l-2 border-border-subtle pl-2">
                          {t.penyusun.map((p, i) => (
                            <li
                              key={`${p.label}-${i}`}
                              className="flex items-baseline justify-between gap-2 text-[11px] leading-[14px]"
                            >
                              <span className="min-w-0 truncate text-muted-foreground">
                                {p.label}
                              </span>
                              <span className="tabular shrink-0">
                                {rupiahRingkas(p.gmv)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </td>
                    <td className="tabular py-2 pr-3 text-right font-semibold">
                      {rupiahRingkas(t.gmv)}
                    </td>
                    <td className="tabular py-2 pr-3 text-right text-muted-foreground">
                      {t.target > 0 ? rupiahRingkas(t.target) : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {t.target > 0 ? (
                        <span
                          className={cn(
                            "tabular rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                            rasio >= 100
                              ? "bg-ok-fill text-ok-text"
                              : rasio >= 90
                                ? "bg-warn-fill text-warn-text"
                                : "bg-danger-fill text-danger-text",
                          )}
                        >
                          {persen(rasio, 0)}
                        </span>
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
