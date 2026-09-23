import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { jamWib, tanggalPanjang } from "@/lib/format";
import { TeksMuncul } from "@/components/motion/teks-muncul";
import type { Pengguna } from "@/lib/types";

export function KartuSapaan({
  pengguna,
  tanggal,
  disinkronPada,
}: {
  pengguna: Pengguna;
  tanggal: string;
  disinkronPada: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-end gap-3 lg:hidden">
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] leading-[14px] font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-ok" />
          Sinkron {jamWib(disinkronPada).replace(" WIB", "")}
        </span>
      </div>

      <Card className="kartu-interaktif ring-border-subtle rounded-3xl shadow-card">
        <div className="flex items-center gap-4 px-5">
          <Avatar className="size-12 shrink-0">
            <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
              {pengguna.inisial}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              {tanggalPanjang(tanggal)}
            </p>
            <h1 className="text-[19px] leading-[26px] font-bold tracking-tight text-balance sm:text-[22px] sm:leading-7 lg:text-[28px] lg:leading-9">
              <TeksMuncul teks={`Halo, ${pengguna.nama}`} />{" "}
              <span aria-hidden>👋</span>
            </h1>
            <p className="text-[12px] leading-4 text-muted-foreground sm:text-[13px] sm:leading-[18px]">
              {pengguna.jabatan}
            </p>
          </div>

          <Link
            href="/tampilan"
            aria-label="Atur tampilan dasbor"
            className="tekan-halus sentuh-nyaman flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontal className="size-4" />
          </Link>
        </div>
      </Card>
    </section>
  );
}
