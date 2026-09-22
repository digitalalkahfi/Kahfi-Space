import Link from "next/link";
import { MapPin, ScrollText, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalPendek } from "@/lib/format";
import {
  GAYA_STATUS_ASET,
  LABEL_STATUS_ASET,
  type BarisLogAset,
} from "@/lib/aset";
import { KeadaanKosong } from "@/components/shared/keadaan";

/**
 * Log perubahan seluruh aset.
 *
 * Satu baris menjawab tiga hal sekaligus: barang apa, jadi keadaan apa,
 * dan di tangan siapa setelahnya — urutan yang sama dengan cara orang
 * menelusurinya saat sesuatu tidak ketemu.
 */
export function LogAset({ daftar }: { daftar: BarisLogAset[] }) {
  if (daftar.length === 0) {
    return (
      <KeadaanKosong
        ikon={<ScrollText className="size-4" />}
        judul="Tidak ada kejadian yang cocok dengan saringan ini"
        pesan="Log aset merekam setiap perpindahan dan perubahan; longgarkan saringan untuk melihat yang lain."
      />
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <h2 className="px-5 text-base leading-6 font-semibold">
        Log perubahan aset
      </h2>

      <ol className="space-y-2 px-5">
        {daftar.map((k) => {
          const gaya = GAYA_STATUS_ASET[k.ke];
          return (
            <li key={k.id} className="rounded-2xl bg-muted/50 p-3.5">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <div className="min-w-[10rem] flex-1">
                  <p className="truncate text-sm leading-5 font-semibold">
                    <Link href={`/aset/${k.kode}`} className="hover:underline">
                      {k.namaAset}
                    </Link>
                  </p>
                  <p className="truncate font-mono text-[11px] leading-[14px] text-muted-foreground">
                    {k.kode} · {k.unitNama}
                  </p>
                </div>

                <span
                  className={cn(
                    "inline-flex h-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                    gaya.kelas,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", gaya.titik)} />
                  {LABEL_STATUS_ASET[k.ke]}
                </span>
              </div>

              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                <span>
                  {k.dari === null
                    ? "sejak diperoleh"
                    : k.dari === k.ke
                      ? "pindah tangan"
                      : `dari ${LABEL_STATUS_ASET[k.dari].toLowerCase()}`}
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserRound className="size-3" />
                  {k.pemegangNama ?? "Tanpa pemegang"}
                </span>
                {k.lokasi ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {k.lokasi}
                  </span>
                ) : null}
                <span>{tanggalPendek(k.pada)}</span>
                {k.olehNama ? <span>dicatat {k.olehNama}</span> : null}
              </p>

              {k.catatan ? (
                <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  {k.catatan}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
