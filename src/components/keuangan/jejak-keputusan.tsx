import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas, tanggalPendek } from "@/lib/format";
import {
  GAYA_STATUS_TRANSAKSI,
  LABEL_STATUS_TRANSAKSI,
  type KeputusanTransaksi,
} from "@/lib/keuangan";

/**
 * Jejak keputusan sebuah transaksi.
 *
 * Posisi kas saat keputusan diambil ikut ditampilkan: itulah yang
 * menentukan siapa yang berwenang memutuskannya (PRD §4), dan tanpa
 * angka itu keputusan lama terlihat sewenang-wenang padahal tidak.
 */
export function JejakKeputusan({ daftar }: { daftar: KeputusanTransaksi[] }) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <History className="size-4 text-muted-foreground" />
          Jejak keputusan
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Tidak pernah disunting; keputusan yang berubah dicatat sebagai
          keputusan baru.
        </p>
      </div>

      {daftar.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Belum ada keputusan — pengajuan ini masih menunggu.
        </p>
      ) : (
        <ol className="space-y-2 px-5">
          {daftar.map((k) => (
            <li key={k.id} className="rounded-2xl bg-muted/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                    GAYA_STATUS_TRANSAKSI[k.ke],
                  )}
                >
                  {LABEL_STATUS_TRANSAKSI[k.ke]}
                </span>
                {k.dari ? (
                  <span className="text-[11px] leading-[14px] text-muted-foreground">
                    dari {LABEL_STATUS_TRANSAKSI[k.dari].toLowerCase()}
                  </span>
                ) : null}
              </div>

              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                <span>{tanggalPendek(k.pada)}</span>
                {k.olehNama ? <span>oleh {k.olehNama}</span> : null}
                {k.saldoKas > 0 ? (
                  <span>kas saat itu {rupiahRingkas(k.saldoKas)}</span>
                ) : null}
                {k.penyetujuWajib ? (
                  <span>wewenang {k.penyetujuWajib}</span>
                ) : null}
              </p>

              {k.catatan ? (
                <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  {k.catatan}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
