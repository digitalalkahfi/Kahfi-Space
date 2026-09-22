"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { menuUtama } from "@/lib/navigasi";
import { MenuLainnya } from "@/components/layout/menu-lainnya";

/** Dock navigasi bawah — hanya tampil di mobile (DESIGN.md §Layout). */
export function BottomNav({
  bolehKeuangan,
  bolehMigrasi,
}: {
  bolehKeuangan: boolean;
  bolehMigrasi: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-2">
        {menuUtama.map((menu) => {
          const aktif = pathname.startsWith(menu.href);
          const Icon = menu.icon;
          return (
            <li key={menu.href} className="flex-1">
              <Link
                href={menu.href}
                aria-current={aktif ? "page" : undefined}
                className="tekan-halus flex flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-muted-foreground"
              >
                <span
                  className={cn(
                    "flex h-9 w-full max-w-[3.5rem] items-center justify-center rounded-full transition-colors",
                    aktif
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={2} />
                </span>
                <span
                  className={cn(
                    "text-[11px] leading-[14px] font-medium",
                    aktif ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {menu.labelPendek}
                </span>
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <MenuLainnya
            bolehKeuangan={bolehKeuangan}
            bolehMigrasi={bolehMigrasi}
          />
        </li>
      </ul>
    </nav>
  );
}
