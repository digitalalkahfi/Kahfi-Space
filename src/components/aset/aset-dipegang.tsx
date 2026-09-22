import Link from "next/link";
import { Boxes, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalPendek } from "@/lib/format";
import { GAYA_STATUS_ASET, LABEL_STATUS_ASET } from "@/lib/aset";
import type { AsetDipegang } from "@/lib/data/aset";

/**
 * Barang perusahaan yang sedang dipegang seseorang.
 *
 * Inilah daftar yang dibaca saat serah terima — pindah unit atau keluar.
 * Tanpa kolom rupiah: yang perlu diketahui atasannya adalah barang apa
 * yang masih di tangannya, bukan berapa harga belinya.
 */
export function AsetDipegangKartu({ daftar }: { daftar: AsetDipegang[] }) {
  if (daftar.length === 0) return null;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <Boxes className="size-4 text-muted-foreground" />
          Aset yang dipegang
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {daftar.length} barang perusahaan ada di tangannya — perlu
          diserahterimakan bila ia pindah atau keluar.
        </p>
      </div>

      <ul className="space-y-2 px-5">
        {daftar.map((a) => {
          const gaya = GAYA_STATUS_ASET[a.status];
          return (
            <li
              key={a.id}
              className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-2xl bg-muted/50 p-3.5"
            >
              <div className="min-w-[10rem] flex-1">
                <p className="truncate text-sm leading-5 font-semibold">
                  <Link href={`/aset/${a.kode}`} className="hover:underline">
                    {a.nama}
                  </Link>
                </p>
                <p className="truncate font-mono text-[11px] leading-[14px] text-muted-foreground">
                  {a.kode}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 truncate text-[11px] leading-[14px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {a.lokasi || "—"}
                  </span>
                  {a.sejak ? <span>sejak {tanggalPendek(a.sejak)}</span> : null}
                </p>
              </div>

              <span
                className={cn(
                  "inline-flex h-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                  gaya.kelas,
                )}
              >
                <span className={cn("size-1.5 rounded-full", gaya.titik)} />
                {LABEL_STATUS_ASET[a.status]}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
