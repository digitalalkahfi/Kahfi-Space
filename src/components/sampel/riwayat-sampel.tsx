import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalPanjang, jamWib } from "@/lib/format";
import {
  GAYA_STATUS_SAMPEL,
  LABEL_STATUS_SAMPEL,
  type KejadianSampel,
} from "@/lib/sampel";

/**
 * Riwayat perpindahan sampel.
 *
 * Yang ditampilkan bukan hanya keadaan barunya, tapi dari mana ia
 * berpindah — itulah yang menjawab "sejak kapan barang ini di sana" dan
 * "siapa yang terakhir memegangnya".
 */
export function RiwayatSampel({ daftar }: { daftar: KejadianSampel[] }) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <History className="size-4 text-muted-foreground" />
          Riwayat perpindahan
        </h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          Tidak pernah disunting; koreksi dicatat sebagai perpindahan baru.
        </p>
      </div>

      {daftar.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum pernah berpindah sejak dicatat.
        </p>
      ) : (
        <ol className="space-y-2 px-5">
          {daftar.map((k) => {
            const gaya = GAYA_STATUS_SAMPEL[k.ke];
            return (
              <li key={k.id} className="rounded-2xl bg-muted/50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                      gaya.kelas,
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", gaya.titik)} />
                    {LABEL_STATUS_SAMPEL[k.ke]}
                  </span>
                  {k.dari ? (
                    <span className="text-[11px] leading-[14px] text-muted-foreground">
                      dari {LABEL_STATUS_SAMPEL[k.dari].toLowerCase()}
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  {tanggalPanjang(k.pada)} · {jamWib(k.pada)}
                  {k.olehNama ? ` · dicatat ${k.olehNama}` : ""}
                  {k.pemegangNama ? ` · dipegang ${k.pemegangNama}` : ""}
                  {k.kreator ? ` · kreator ${k.kreator}` : ""}
                </p>

                {k.catatan ? (
                  <p className="mt-0.5 text-[11px] leading-[14px] text-pretty">
                    {k.catatan}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
