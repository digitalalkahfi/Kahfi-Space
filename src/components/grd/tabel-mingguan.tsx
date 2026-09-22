import { AlertTriangle, CalendarCheck2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen, rupiahRingkas, tanggalPendek } from "@/lib/format";
import { gayaKeputusanWrm } from "@/lib/unit";
import type { LaporanMingguan } from "@/lib/data/grd";

/** Riwayat matriks WRM per pekan, dengan penandaan merah beruntun. */
export function TabelMingguan({ daftar }: { daftar: LaporanMingguan[] }) {
  const beruntun = daftar.find((d) => d.merahBeruntun >= 2);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Laporan mingguan
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Matriks WRM tiap pekan: hasil × langkah kunci
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <CalendarCheck2 className="size-4" />
        </span>
      </div>

      {beruntun ? (
        <p className="mx-5 flex items-start gap-2 rounded-2xl bg-danger-fill px-4 py-2.5 text-[13px] leading-[18px] text-danger-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="text-pretty">
            Hasil merah {beruntun.merahBeruntun} pekan berturut-turut. Ini bukan
            lagi fluktuasi — rencananya perlu dibahas ulang.
          </span>
        </p>
      ) : null}

      {daftar.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada laporan mingguan.
        </p>
      ) : (
        <ul className="space-y-2 px-5">
          {daftar.map((w) => {
            const gaya = gayaKeputusanWrm[w.keputusan];
            return (
              <li
                key={`${w.periode}-${w.unit ?? "semua"}`}
                className="baris-interaktif rounded-2xl bg-muted/50 p-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] leading-[18px] font-semibold">
                    Pekan {tanggalPendek(w.periode)}
                    {w.unit ? ` · ${w.unit}` : ""}
                  </p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold tracking-[0.04em] uppercase",
                      gaya.kelas,
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", gaya.titik)} />
                    {w.keputusan}
                  </span>
                </div>

                <dl className="tabular mt-2 grid grid-cols-2 gap-2 text-[11px] leading-[14px] sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">GMV</dt>
                    <dd className="font-semibold">
                      {rupiahRingkas(w.gmvTotal)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Target</dt>
                    <dd className="font-semibold">
                      {rupiahRingkas(w.targetMingguan)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Hasil</dt>
                    <dd
                      className={cn(
                        "font-semibold",
                        w.hasilHijau ? "text-ok-text" : "text-danger-text",
                      )}
                    >
                      {persen(w.rasioHasil)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">KRI</dt>
                    <dd
                      className={cn(
                        "font-semibold",
                        w.kriHijau ? "text-ok-text" : "text-danger-text",
                      )}
                    >
                      {persen(w.rasioKri)}
                    </dd>
                  </div>
                </dl>

                {w.merahBeruntun >= 2 ? (
                  <p className="mt-2 text-[11px] leading-[14px] font-semibold text-danger-text">
                    Merah {w.merahBeruntun} pekan beruntun
                  </p>
                ) : null}

                {w.ringkasan ? (
                  <p className="mt-1.5 text-[11px] leading-[14px] text-muted-foreground">
                    {w.ringkasan}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
