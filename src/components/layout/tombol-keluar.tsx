"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { keluar } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

/**
 * Keluar dari sesi.
 *
 * Di mode demo tidak ada sesi untuk diakhiri, jadi tombolnya tidak
 * ditampilkan sama sekali — lebih jujur daripada tombol yang tak berefek.
 */
export function TombolKeluar({ className }: { className?: string }) {
  const [keluarSedang, mulai] = useTransition();

  return (
    <button
      type="button"
      aria-label="Keluar"
      title="Keluar"
      disabled={keluarSedang}
      onClick={() => mulai(async () => void (await keluar()))}
      className={cn(
        "tekan-halus sentuh-nyaman flex size-9 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground disabled:opacity-60",
        className,
      )}
    >
      <LogOut className="size-4" />
    </button>
  );
}
