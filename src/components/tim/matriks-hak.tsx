import { Check, Minus, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DAFTAR_PERAN, matriksHakAkses } from "@/lib/hak-akses";

/**
 * Matriks hak akses: kemampuan × peran.
 *
 * Tiap sel dihitung dari fungsi yang dipakai halaman sungguhan, jadi
 * tabel ini tidak bisa menjanjikan sesuatu yang tidak berlaku. Yang
 * ditampilkan tetap lapisan tampilan — pembatasan sebenarnya ada di
 * Row Level Security, dan itu disebut di keterangannya.
 */
export function MatriksHak() {
  const baris = matriksHakAkses();

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">Hak akses</h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Apa yang bisa dilakukan tiap peran. Yang menutup pintunya sebenarnya
            aturan di database; tabel ini menjelaskan aturannya, bukan
            menggantikannya.
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <ShieldCheck className="size-4" />
        </span>
      </div>

      <div className="overflow-x-auto px-5">
        <table className="w-full min-w-[34rem] border-collapse text-[13px] leading-[18px]">
          <caption className="sr-only">
            Kemampuan tiap peran di K-Space V2
          </caption>
          <thead>
            <tr className="border-b border-border-subtle text-left">
              <th
                scope="col"
                className="py-2 pr-3 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
              >
                Kemampuan
              </th>
              {DAFTAR_PERAN.map((p) => (
                <th
                  key={p}
                  scope="col"
                  className="py-2 pr-3 text-center text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase last:pr-0"
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr
                key={b.kunci}
                className="border-b border-border-subtle last:border-0"
              >
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  {b.label}
                  <span className="block text-[11px] leading-[14px] font-normal text-pretty text-muted-foreground">
                    {b.alasan}
                  </span>
                </th>
                {DAFTAR_PERAN.map((p) => (
                  <td key={p} className="py-2 pr-3 text-center last:pr-0">
                    <span
                      className={cn(
                        "inline-flex size-5 items-center justify-center rounded-full",
                        b.per[p]
                          ? "bg-ok-fill text-ok-text"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {b.per[p] ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : (
                        <Minus className="size-3" />
                      )}
                      <span className="sr-only">
                        {p} {b.per[p] ? "bisa" : "tidak bisa"} {b.label}
                      </span>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
