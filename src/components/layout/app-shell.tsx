import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarRail } from "@/components/layout/sidebar-rail";
import { bolehLihatKeuangan } from "@/lib/keuangan";
import { SpandukLama } from "@/components/layout/spanduk-lama";
import { TopBar } from "@/components/layout/top-bar";
import { statusKspaceLama } from "@/lib/data/migrasi";
import { modeData } from "@/lib/supabase/config";
import type { Pengguna } from "@/lib/types";

/**
 * Kerangka aplikasi: rail ikon di desktop, dock bawah di mobile.
 * Konten duduk di atas kanvas netral dengan margin tepi yang konsisten.
 */
export async function AppShell({
  pengguna,
  halaman,
  children,
}: {
  pengguna: Pengguna;
  halaman: string;
  children: ReactNode;
}) {
  const lama = await statusKspaceLama();
  const bolehMigrasi = pengguna.role === "CEO" || pengguna.role === "Manager";
  const bolehKeuangan = bolehLihatKeuangan(pengguna.role);

  return (
    <div className="min-h-dvh lg:pl-16">
      <SidebarRail
        demo={modeData() === "demo"}
        bolehMigrasi={bolehMigrasi}
        bolehKeuangan={bolehKeuangan}
      />
      <TopBar pengguna={pengguna} halaman={halaman} />
      <SpandukLama status={lama} />
      <main className="mx-auto w-full max-w-[1400px] px-4 pt-4 pb-28 lg:px-8 lg:pt-6 lg:pb-10">
        {children}
      </main>
      <BottomNav bolehKeuangan={bolehKeuangan} bolehMigrasi={bolehMigrasi} />
    </div>
  );
}
