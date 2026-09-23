import Link from "next/link";
import { ArrowRight, ShieldCheck, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bilangan } from "@/lib/format";

export type Penghalang = {
  pesan: string;
  tautan?: { href: string; label: string };
};

/**
 * Apakah migrasi sungguhan sudah boleh dijalankan, dan kalau belum, apa
 * yang menahannya.
 *
 * Sebelumnya jawabannya tersebar: persetujuan di satu layar, orang yang
 * menunggu di layar lain, dan kesiapannya sendiri hanya muncul sebagai
 * tombol mati tanpa penjelasan. Orang yang tidak tahu apa yang kurang
 * akan mencoba lagi dan lagi — atau lebih buruk, mencari jalan memutar.
 */
export function PanelKesiapan({
  disetujui,
  total,
  penghalang,
}: {
  disetujui: number;
  total: number;
  penghalang: Penghalang[];
}) {
  const siap = penghalang.length === 0;

  return (
    <Card
      className={cn(
        "rounded-3xl",
        siap
          ? "bg-ok-fill shadow-none ring-0"
          : "shadow-card ring-border-subtle",
      )}
    >
      <div className="px-5">
        <p
          className={cn(
            "flex items-start gap-2 text-[13px] leading-[18px] text-pretty",
            siap ? "text-ok-text" : "text-muted-foreground",
          )}
        >
          {siap ? (
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          )}
          <span>
            {bilangan(disetujui)} dari {bilangan(total)} kelompok disetujui.
            {siap
              ? " Tidak ada lagi yang menahan; migrasi sungguhan boleh dijalankan."
              : " Migrasi sungguhan masih ditahan."}
          </span>
        </p>
      </div>

      {penghalang.length > 0 ? (
        <ul className="space-y-1 px-5">
          {penghalang.map((p) => (
            <li
              key={p.pesan}
              className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted px-4 py-2.5"
            >
              <span className="min-w-0 flex-1 text-[13px] leading-[18px] text-pretty">
                {p.pesan}
              </span>
              {p.tautan ? (
                <Link
                  href={p.tautan.href}
                  className="tekan-halus sentuh-nyaman inline-flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[11px] leading-[14px] font-semibold ring-1 ring-border-subtle"
                >
                  {p.tautan.label}
                  <ArrowRight className="size-3.5" />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
