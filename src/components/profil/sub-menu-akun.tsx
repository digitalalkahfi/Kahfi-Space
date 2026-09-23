"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Sub-menu akun: profil dan keamanan.
 *
 * Dua halaman ini sengaja tidak masuk sidebar — pintu masuknya adalah
 * kartu profil di app-bar, dan menambah dua ikon lagi di rail hanya
 * membuatnya ramai tanpa membuat apa pun lebih cepat ditemukan.
 */
const MENU = [
  { href: "/profil", label: "Profil" },
  { href: "/keamanan", label: "Keamanan akun" },
  { href: "/tampilan", label: "Tampilan" },
];

export function SubMenuAkun() {
  const pathname = usePathname();
  const persona = useSearchParams().get("persona");

  return (
    <nav
      aria-label="Bagian akun"
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
    >
      {MENU.map((m) => {
        const aktif = pathname === m.href || pathname.startsWith(`${m.href}/`);
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
