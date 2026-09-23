"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { menuPendampingTerlihat, menuUtama } from "@/lib/navigasi";
import { MenuLainnya, type IsiLaci } from "@/components/layout/menu-lainnya";
import { useSusunan } from "@/components/tampilan/penyedia-tampilan";
import { pecahDock } from "@/lib/tampilan";

/**
 * Dock navigasi bawah — hanya tampil di mobile (DESIGN.md §Layout).
 *
 * Dock dan laci dibagi dari SATU daftar terurut: lima teratas jadi
 * ikon, sisanya isi laci. Batas lima itu lebar layar, bukan selera —
 * slot keenam sudah dipakai tombol laci.
 */
export function BottomNav({
  bolehKeuangan,
  bolehMigrasi,
}: {
  bolehKeuangan: boolean;
  bolehMigrasi: boolean;
}) {
  const pathname = usePathname();
  const urut = useSusunan("dock");

  const semua: IsiLaci[] = [
    ...menuUtama.map((m) => ({
      href: m.href,
      label: m.label,
      keterangan: "Menu utama",
      icon: m.icon,
    })),
    ...menuPendampingTerlihat({
      keuangan: bolehKeuangan,
      migrasi: bolehMigrasi,
    }),
  ];

  const { dock, laci } = pecahDock(urut(semua));
  const pendek = new Map(menuUtama.map((m) => [m.href, m.labelPendek]));

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-2">
        {dock.map((menu) => {
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
                  {pendek.get(menu.href) ?? menu.label}
                </span>
              </Link>
            </li>
          );
        })}

        {laci.length > 0 ? (
          <li className="flex-1">
            <MenuLainnya menu={laci} />
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
