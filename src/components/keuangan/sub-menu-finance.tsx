"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Sub-menu Finance (PRD Fase 1).
 *
 * Aset & Inventaris ikut di sini, bukan lagi di sidebar utama: ia lahir
 * dari transaksi berjenis aset, dan menaruhnya di dua tempat membuat
 * sidebar makin ramai tanpa menambah apa pun.
 */
const MENU = [
  { href: "/keuangan", label: "Dashboard" },
  { href: "/keuangan/transaksi", label: "Transaksi" },
  { href: "/keuangan/laporan", label: "Laporan" },
  { href: "/keuangan/budget", label: "Budget" },
  { href: "/keuangan/depresiasi", label: "Depresiasi" },
  { href: "/aset", label: "Aset & Inventaris" },
];

export function SubMenuFinance() {
  const pathname = usePathname();
  const params = useSearchParams();
  const persona = params.get("persona");

  return (
    <nav
      aria-label="Bagian Finance"
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
    >
      {MENU.map((m) => {
        // `/keuangan` cocok persis; sisanya juga cocok untuk halaman
        // turunannya, mis. `/aset/AST-0001`.
        const aktif =
          m.href === "/keuangan"
            ? pathname === "/keuangan"
            : pathname.startsWith(m.href);

        return (
          <Link
            key={m.href}
            href={persona ? `${m.href}?persona=${persona}` : m.href}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
              aktif
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
            )}
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
