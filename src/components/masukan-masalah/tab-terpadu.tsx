"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type TabTerpadu = "masukan" | "bug" | "masalah";

export const TAB_TERPADU: { kunci: TabTerpadu; label: string }[] = [
  { kunci: "masukan", label: "Masukan & Saran" },
  { kunci: "bug", label: "Bug" },
  { kunci: "masalah", label: "Kaizen" },
];

/**
 * Tab halaman gabungan Masukan & Masalah.
 *
 * Tautan, bukan tombol berstate: tiap tab punya saringannya sendiri di
 * URL, dan tautan membuat "bug yang belum ditinjau" bisa dikirim ke
 * orang lain apa adanya. Berpindah tab juga melepas saringan tab
 * sebelumnya — saringan bug tidak berarti apa-apa bagi daftar Kaizen.
 */
export function TabTerpaduNav({
  aktif,
  jumlah,
}: {
  aktif: TabTerpadu;
  jumlah: Record<TabTerpadu, number>;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const persona = params.get("persona");

  return (
    <nav
      aria-label="Bagian masukan dan masalah"
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
    >
      {TAB_TERPADU.map((t) => {
        const ke = new URLSearchParams();
        if (t.kunci !== "masukan") ke.set("tab", t.kunci);
        if (persona) ke.set("persona", persona);
        const query = ke.toString();

        return (
          <Link
            key={t.kunci}
            href={query ? `${pathname}?${query}` : pathname}
            aria-current={t.kunci === aktif ? "page" : undefined}
            className={cn(
              "tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
              t.kunci === aktif
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
            )}
          >
            {t.label}
            <span
              className={cn(
                "tabular rounded-full px-1.5 text-[10px] leading-[14px]",
                t.kunci === aktif
                  ? "bg-primary-foreground/20"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {jumlah[t.kunci]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
