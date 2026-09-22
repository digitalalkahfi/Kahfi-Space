import Link from "next/link";
import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { jamWib, tanggalPendek } from "@/lib/format";
import { GAYA_STATUS_SAMPEL, LABEL_STATUS_SAMPEL } from "@/lib/sampel";
import type { BarisRiwayat } from "@/lib/saring-sampel";
import { KeadaanKosong } from "@/components/shared/keadaan";

/** Riwayat perpindahan seluruh sampel yang terlihat pengguna. */
export function TabelRiwayatSampel({ daftar }: { daftar: BarisRiwayat[] }) {
  if (daftar.length === 0) {
    return (
      <KeadaanKosong
        ikon={<History className="size-4" />}
        judul="Tidak ada perpindahan yang cocok dengan saringan ini"
        pesan="Longgarkan saringan untuk melihat perpindahan sampel lainnya."
      />
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <h2 className="flex items-center gap-2 px-5 text-base leading-6 font-semibold">
        <History className="size-4 text-muted-foreground" />
        Riwayat perpindahan
      </h2>

      <ol className="space-y-2 px-5">
        {daftar.map((b) => {
          const gaya = GAYA_STATUS_SAMPEL[b.ke];
          return (
            <li key={b.id} className="rounded-2xl bg-muted/50 p-3">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <div className="min-w-[9rem] flex-1">
                  <p className="truncate text-[13px] leading-[18px] font-semibold">
                    <Link
                      href={`/sampel/${encodeURIComponent(b.kode)}`}
                      className="hover:underline"
                    >
                      {b.namaSampel}
                    </Link>
                  </p>
                  <p className="truncate font-mono text-[11px] leading-[14px] text-muted-foreground">
                    {b.kode} · {b.unitNama}
                  </p>
                </div>

                <span
                  className={cn(
                    "inline-flex h-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                    gaya.kelas,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", gaya.titik)} />
                  {LABEL_STATUS_SAMPEL[b.ke]}
                </span>
              </div>

              <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                {tanggalPendek(b.pada)} · {jamWib(b.pada)}
                {b.dari
                  ? ` · dari ${LABEL_STATUS_SAMPEL[b.dari].toLowerCase()}`
                  : ""}
                {b.olehNama ? ` · dicatat ${b.olehNama}` : ""}
                {b.pemegangNama ? ` · dipegang ${b.pemegangNama}` : ""}
                {b.kreator ? ` · kreator ${b.kreator}` : ""}
              </p>

              {b.catatan ? (
                <p className="mt-0.5 text-[11px] leading-[14px] text-pretty">
                  {b.catatan}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
