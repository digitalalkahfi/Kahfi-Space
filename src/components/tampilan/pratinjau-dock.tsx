"use client";

import { LayoutGrid, Squircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { menuPendamping, menuUtama } from "@/lib/navigasi";
import { pecahDock, type ItemTampilan } from "@/lib/tampilan";

/**
 * Ikon per menu, dirakit dari daftar navigasi yang sungguhan.
 *
 * Ikonnya tidak ikut di `lib/tampilan.ts` supaya modul itu tetap murni
 * dan bisa diuji tanpa React; yang memasangkannya adalah lapisan
 * tampilan, di sini.
 */
const IKON: Record<string, LucideIcon> = Object.fromEntries([
  ...menuUtama.map((m) => [m.href, m.icon] as const),
  ...menuPendamping.map((m) => [m.href, m.icon] as const),
]);

/** Label pendek dipakai dock sungguhan; di sini ikut dipakai. */
const LABEL_PENDEK: Record<string, string> = Object.fromEntries(
  menuUtama.map((m) => [m.href, m.labelPendek] as const),
);

/**
 * Tiruan dock ponsel.
 *
 * Kalimat "lima teratas jadi dock" mudah ditulis dan sulit dipercaya
 * sebelum terlihat. Yang digambar di sini bentuk yang sama dengan dock
 * sungguhnya — termasuk tombol "Lainnya" yang selalu memakai satu slot
 * keenam, sebab tanpa itu orang mengira dock memuat enam menu.
 */
export function PratinjauDock({ terlihat }: { terlihat: ItemTampilan[] }) {
  const { dock, laci } = pecahDock(terlihat);

  return (
    <div className="space-y-2 rounded-2xl bg-muted/50 p-3">
      <p className="text-[11px] leading-[14px] font-semibold">
        Tampak di ponsel
      </p>

      <div className="overflow-x-auto">
        <ul className="flex min-w-fit items-stretch gap-1 rounded-2xl bg-card p-2 ring-1 ring-border-subtle">
          {dock.map((item, i) => {
            const Icon = IKON[item.kunci] ?? Squircle;
            return (
              <li
                key={item.kunci}
                className="flex min-w-[3.75rem] flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    "flex h-8 w-full items-center justify-center rounded-full",
                    // Slot pertama selalu halaman yang sedang dibuka di
                    // dock sungguhan; di sini cukup satu penanda aktif.
                    i === 0
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-[17px]" strokeWidth={2} />
                </span>
                <span className="w-full truncate text-center text-[10px] leading-[13px] text-muted-foreground">
                  {LABEL_PENDEK[item.kunci] ?? item.label}
                </span>
              </li>
            );
          })}

          {/* Tombol laci bukan pilihan pengguna: ia muncul selama masih
              ada sisa menu, dan memakan slot keenam. Kalau tidak ada
              sisa, ia hilang — tombol yang membuka lembar kosong adalah
              kontrol mati. */}
          {laci.length === 0 ? null : (
            <li className="flex min-w-[3.75rem] flex-col items-center gap-1">
              <span className="flex h-8 w-full items-center justify-center rounded-full text-muted-foreground">
                <LayoutGrid className="size-[17px]" strokeWidth={2} />
              </span>
              <span className="w-full truncate text-center text-[10px] leading-[13px] text-muted-foreground">
                Lainnya
              </span>
            </li>
          )}
        </ul>
      </div>

      <p className="text-[11px] leading-[16px] text-pretty text-muted-foreground">
        {laci.length === 0 ? (
          "Semua yang kamu centang muat di dock; lacinya kosong."
        ) : (
          <>
            <span className="font-semibold text-foreground">
              Di dalam laci:
            </span>{" "}
            {laci.map((i) => i.label).join(" · ")}
          </>
        )}
      </p>
    </div>
  );
}
