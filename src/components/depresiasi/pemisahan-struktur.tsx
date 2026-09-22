import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas } from "@/lib/format";
import { strukturKeuangan, type KelompokStruktur } from "@/lib/depresiasi";
import type { RingkasKeuangan } from "@/lib/keuangan";

const GAYA: Record<KelompokStruktur, string> = {
  pendapatan: "text-ok-text",
  cogs: "text-warn-text",
  opex: "text-warn-text",
  depresiasi: "text-secondary",
  total: "text-foreground",
  diluar: "text-muted-foreground",
};

/**
 * Struktur laba: Revenue, COGS, Opex, Depresiasi, lalu yang di luar laba.
 *
 * Yang membuat NPM lama menyesatkan bukan satu kesalahan hitung,
 * melainkan tiga hal yang tercampur: direct cost dianggap beban biasa,
 * pembelian aset dianggap biaya, dan penyusutan tidak pernah muncul.
 * Di sini ketiganya berdiri sendiri, dan yang bukan biaya ditaruh di
 * bawah garis.
 */
export function PemisahanStruktur({
  ringkas,
  depresiasi,
}: {
  ringkas: RingkasKeuangan;
  depresiasi: number;
}) {
  const baris = strukturKeuangan(ringkas, depresiasi);
  const diLuar = baris.filter((b) => b.kelompok === "diluar");
  const utama = baris.filter((b) => b.kelompok !== "diluar");

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Revenue → COGS → Opex → Depresiasi
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Empat hal yang dulu tercampur, kini berdiri sendiri-sendiri.
        </p>
      </div>

      <ul className="tabular space-y-1.5 px-5">
        {utama.map((b) => (
          <li
            key={b.label}
            className={cn(
              "rounded-2xl px-3 py-2",
              b.kelompok === "total" ? "bg-muted/50" : "",
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span
                className={cn(
                  "text-[13px] leading-[18px]",
                  b.kelompok === "total"
                    ? "font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {b.label}
              </span>
              <span
                className={cn(
                  "text-[13px] leading-[18px] font-semibold",
                  GAYA[b.kelompok],
                )}
              >
                {b.nilai < 0 ? "−" : ""}
                {rupiahRingkas(Math.abs(b.nilai))}
              </span>
            </div>
            <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
              {b.keterangan}
            </p>
          </li>
        ))}
      </ul>

      <div className="px-5">
        <p className="border-t border-border-subtle pt-3 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          Di luar laba rugi
        </p>

        <ul className="tabular mt-1.5 space-y-1.5">
          {diLuar.map((b) => (
            <li key={b.label} className="rounded-2xl px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[13px] leading-[18px] text-muted-foreground">
                  {b.label}
                </span>
                <span className="text-[13px] leading-[18px] font-semibold text-muted-foreground">
                  {b.nilai < 0 ? "−" : ""}
                  {rupiahRingkas(Math.abs(b.nilai))}
                </span>
              </div>
              <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                {b.keterangan}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
