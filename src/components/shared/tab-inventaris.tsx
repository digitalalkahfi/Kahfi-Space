"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Package } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pemisah Aset dan Sampel.
 *
 * Keduanya sama-sama barang yang dipegang orang, dan itulah masalahnya:
 * tanpa pemisah yang jelas, laptop kantor dan sampel skincare tercampur
 * dalam satu daftar padahal aturannya berbeda — aset disusutkan dan
 * dimiliki, sampel berpindah tangan lalu habis atau kembali.
 *
 * Dibuat sebagai tautan, bukan tab berisi keadaan: keduanya halaman
 * sendiri dengan saringan sendiri di URL, dan tautan membuat keduanya
 * bisa dibagikan apa adanya.
 */
export function TabInventaris() {
  const pathname = usePathname();

  const tab = [
    { href: "/aset", label: "Aset", icon: Boxes },
    { href: "/sampel", label: "Sampel", icon: Package },
  ];

  return (
    <nav
      aria-label="Jenis inventaris"
      className="flex w-full gap-1 rounded-full bg-muted p-1 sm:w-fit"
    >
      {tab.map((t) => {
        const aktif = pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "tekan-halus sentuh-nyaman inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[11px] leading-[14px] font-semibold whitespace-nowrap transition-colors sm:flex-none",
              aktif
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
