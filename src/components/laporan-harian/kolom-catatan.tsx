"use client";

import { useLayoutEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const MAKS_CATATAN = 200;

/**
 * Catatan harian — opsional. Diisi kalau ada hal penting atau kendala;
 * laporan tetap bisa dikirim tanpa catatan (PRD §3 Laporan Harian).
 * Kotaknya tumbuh mengikuti isi supaya tidak perlu menggulir di HP.
 */
export function KolomCatatan({
  id = "catatan",
  nilai,
  onUbah,
  maks = MAKS_CATATAN,
}: {
  id?: string;
  nilai: string;
  onUbah: (teks: string) => void;
  maks?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [nilai]);

  const sisa = maks - nilai.length;
  const hampirPenuh = sisa <= 20;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold"
        >
          <MessageSquare className="size-3.5 text-muted-foreground" />
          Catatan harian
        </label>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] leading-[13px] font-semibold text-muted-foreground">
          Opsional
        </span>
      </div>

      <textarea
        ref={ref}
        id={id}
        rows={3}
        maxLength={maks}
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        placeholder="Hal penting atau kendala hari ini…"
        aria-describedby={`${id}-sisa`}
        className="min-h-[88px] w-full resize-none rounded-xl bg-muted px-4 py-3 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
      />

      <div className="flex items-center justify-between gap-2 text-[11px] leading-[14px]">
        <span className="text-muted-foreground">
          Boleh dikosongkan kalau hari ini berjalan normal.
        </span>
        <span
          id={`${id}-sisa`}
          className={cn(
            "tabular shrink-0",
            hampirPenuh
              ? "font-semibold text-warn-text"
              : "text-muted-foreground",
          )}
        >
          {nilai.length}/{maks}
        </span>
      </div>
    </div>
  );
}
