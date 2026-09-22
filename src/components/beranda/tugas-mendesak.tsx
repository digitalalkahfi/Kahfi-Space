import Link from "next/link";
import { CircleAlert, CircleCheck, Clock, FileWarning } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { jamWib } from "@/lib/format";
import type { Prioritas, Tugas } from "@/lib/types";

const gayaPrioritas: Record<
  Prioritas,
  { kartu: string; label: string; ikon: typeof CircleAlert; warna: string }
> = {
  tinggi: {
    kartu: "bg-danger-fill",
    label: "bg-danger-fill text-danger-text",
    ikon: CircleAlert,
    warna: "text-danger-text",
  },
  sedang: {
    kartu: "bg-info-fill",
    label: "bg-info-fill text-info-text",
    ikon: CircleCheck,
    warna: "text-info-text",
  },
  rendah: {
    kartu: "bg-accentmuted-fill",
    label: "bg-accentmuted-fill text-accentmuted-text",
    ikon: FileWarning,
    warna: "text-accentmuted-text",
  },
};

/** To-do & tiket yang jatuh tempo hari ini (PRD §3 Beranda — To-do Hari Ini). */
export function TugasMendesak({ tugas }: { tugas: Tugas[] }) {
  return (
    <Card className="kartu-interaktif ring-border-subtle rounded-3xl shadow-card">
      <div className="flex items-center justify-between gap-3 px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          Tugas &amp; Tiket Mendesak
          <span className="flex size-5 items-center justify-center rounded-full bg-danger-fill text-[11px] leading-none font-semibold text-danger-text">
            {tugas.length}
          </span>
        </h2>
        <Link
          href="/tugas"
          className="sentuh-nyaman shrink-0 text-[13px] leading-[18px] font-semibold text-secondary hover:underline"
        >
          Lihat semua
        </Link>
      </div>

      <ul className="space-y-2.5 px-5">
        {tugas.map((t) => {
          const gaya = gayaPrioritas[t.prioritas];
          const Icon = gaya.ikon;
          return (
            <li
              key={t.id}
              className={cn("baris-interaktif rounded-2xl p-3.5", gaya.kartu)}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-card",
                    gaya.warna,
                  )}
                >
                  <Icon className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm leading-5 font-semibold">{t.judul}</p>
                    <span className="tabular flex shrink-0 items-center gap-1 text-[11px] leading-[14px] font-medium text-muted-foreground">
                      <Clock className="size-3" />
                      {jamWib(t.tenggat)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-[18px] text-muted-foreground">
                    {t.deskripsi}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full bg-card px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                        gaya.warna,
                      )}
                    >
                      {t.label}
                    </span>
                    <span className="text-[11px] leading-[14px] text-muted-foreground">
                      PIC: {t.penerima}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
