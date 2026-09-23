"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LayoutGrid } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type IsiLaci = {
  href: string;
  label: string;
  keterangan: string;
  icon: LucideIcon;
};

/**
 * Laci menu untuk mobile.
 *
 * Dock bawah hanya memuat lima ikon, jadi tanpa laci ini Keuangan,
 * Aset, Sampel, dan sisanya hanya bisa dibuka dari desktop — yang
 * keliru untuk aplikasi yang dipakai dari HP.
 *
 * Isinya dititipkan `BottomNav`, bukan dihitung di sini: dock dan laci
 * dua bagian dari satu daftar yang sama, dan menghitungnya dua kali
 * membuat sebuah menu bisa muncul di keduanya — atau di tidak satu pun.
 */
export function MenuLainnya({ menu }: { menu: IsiLaci[] }) {
  const [buka, setBuka] = useState(false);
  const pathname = usePathname();
  const adaYangAktif = menu.some((m) => pathname.startsWith(m.href));

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Menu lainnya"
          className="tekan-halus flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-muted-foreground"
        >
          <span
            className={cn(
              "flex h-9 w-full max-w-[3.5rem] items-center justify-center rounded-full transition-colors",
              adaYangAktif
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            <LayoutGrid className="size-[18px]" strokeWidth={2} />
          </span>
          <span
            className={cn(
              "text-[11px] leading-[14px] font-medium",
              adaYangAktif ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Lainnya
          </span>
        </button>
      </DialogTrigger>

      <DialogContent
        className="top-auto bottom-0 max-w-lg translate-y-0 gap-3 rounded-b-none rounded-t-3xl bg-card p-0 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:max-w-md"
        showCloseButton={false}
      >
        {/* Pegangan laci: penanda bahwa lembar ini bisa ditutup. */}
        <span
          aria-hidden
          className="mx-auto mt-3 h-1 w-10 rounded-full bg-border-subtle"
        />

        <DialogHeader className="px-5">
          <DialogTitle className="text-base leading-6 font-semibold">
            Menu lainnya
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Modul di luar lima menu utama.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[60dvh] space-y-1.5 overflow-y-auto px-5 pb-4">
          {menu.map((m) => {
            const aktif = pathname.startsWith(m.href);
            const Icon = m.icon;
            return (
              <li key={m.href}>
                <Link
                  href={m.href}
                  onClick={() => setBuka(false)}
                  aria-current={aktif ? "page" : undefined}
                  className={cn(
                    "tekan-halus sentuh-nyaman flex items-center gap-3 rounded-2xl p-3 text-left",
                    aktif ? "bg-primary/10" : "bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-2xl",
                      aktif
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm leading-5 font-semibold">
                      {m.label}
                    </span>
                    <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                      {m.keterangan}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
