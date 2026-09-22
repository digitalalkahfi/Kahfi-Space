"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { menuPendampingTerlihat, menuUtama } from "@/lib/navigasi";
import { TombolKeluar } from "@/components/layout/tombol-keluar";
import type { LucideIcon } from "lucide-react";

function TautanRail({
  href,
  label,
  icon: Icon,
  aktif,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  aktif: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={aktif ? "page" : undefined}
      className={cn(
        "tekan-halus flex size-11 items-center justify-center rounded-2xl",
        aktif
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-[19px]" strokeWidth={2} />
    </Link>
  );
}

/** Rail ikon 64px di sisi kiri — desktop saja (DESIGN.md §Layout). */
export function SidebarRail({
  demo,
  bolehMigrasi,
  bolehKeuangan,
}: {
  demo: boolean;
  bolehMigrasi: boolean;
  /** Angka perusahaan: hanya Finance, Manager, dan CEO. */
  bolehKeuangan: boolean;
}) {
  const pathname = usePathname();
  // Kalender dan Kaizen sudah punya pintasan di app-bar atas; tidak
  // diulang di rail supaya pintu masuknya cuma satu.
  const pendamping = menuPendampingTerlihat(
    { keuangan: bolehKeuangan, migrasi: bolehMigrasi },
    { kecualiAppBar: true },
  );

  return (
    // Rail bisa lebih tinggi dari layar begitu menu pendampingnya banyak;
    // tanpa gulir, ikon terakhir terpotong di laptop pendek.
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center overflow-y-auto border-r border-border-subtle bg-canvas py-5 lg:flex">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <Link
          href="/beranda"
          aria-label="K-Space V2"
          className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
        >
          <span className="text-sm font-bold tracking-tight">K</span>
        </Link>

        {menuUtama.map((menu) => (
          <TautanRail
            key={menu.href}
            href={menu.href}
            label={menu.label}
            icon={menu.icon}
            aktif={pathname.startsWith(menu.href)}
          />
        ))}
      </div>

      <div className="mt-auto flex shrink-0 flex-col items-center gap-1 pt-6">
        {pendamping.map((menu) => (
          <TautanRail
            key={menu.href}
            href={menu.href}
            label={menu.label}
            icon={menu.icon}
            aktif={pathname.startsWith(menu.href)}
          />
        ))}

        {demo ? null : (
          <TombolKeluar className="size-11 rounded-2xl bg-transparent ring-0 hover:bg-muted" />
        )}
      </div>
    </aside>
  );
}
