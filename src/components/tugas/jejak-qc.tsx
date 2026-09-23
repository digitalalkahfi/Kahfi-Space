"use client";

import { useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { jamWib, tanggalPendek } from "@/lib/format";
import type { JejakQc } from "@/lib/data/tugas";

/**
 * Riwayat pemeriksaan satu tugas.
 *
 * Kartu hanya menampilkan catatan pemeriksaan terakhir, padahal tugas
 * yang bolak-balik revisi punya cerita yang lebih panjang — dan justru
 * putaran sebelumnya yang menjelaskan kenapa hasilnya begini.
 *
 * Tertutup secara bawaan: ini konteks saat dibutuhkan, bukan yang perlu
 * dibaca setiap kali papan dibuka.
 */
export function JejakPemeriksaan({ jejak }: { jejak: JejakQc[] }) {
  const [buka, setBuka] = useState(false);
  if (jejak.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setBuka(!buka)}
        aria-expanded={buka}
        className="tekan-halus sentuh-nyaman flex w-full items-center gap-1.5 rounded-xl px-1 py-1 text-[11px] leading-[14px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <History className="size-3" />
        Riwayat pemeriksaan ({jejak.length})
        <ChevronDown
          className={cn(
            "ml-auto size-3 transition-transform",
            buka && "rotate-180",
          )}
        />
      </button>

      {buka ? (
        <ol className="space-y-1.5">
          {jejak.map((j) => (
            <li key={j.id} className="rounded-xl bg-muted/70 px-3 py-2">
              <p className="flex flex-wrap items-center gap-1.5 text-[11px] leading-[14px] font-semibold">
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] leading-[13px]",
                    j.hasil === "lolos"
                      ? "bg-ok-fill text-ok-text"
                      : "bg-warn-fill text-warn-text",
                  )}
                >
                  {j.hasil === "lolos" ? "Lolos" : "Revisi"}
                </span>
                <span className="font-normal text-muted-foreground">
                  {j.diperiksaOleh} · {tanggalPendek(j.createdAt)}{" "}
                  {jamWib(j.createdAt)}
                </span>
              </p>
              {j.hasilKerja ? (
                <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  <span className="font-semibold">Hasil kerja saat itu: </span>
                  {j.hasilKerja}
                </p>
              ) : null}
              {j.catatan ? (
                <p className="mt-0.5 text-[11px] leading-[14px] text-pretty">
                  {j.catatan}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
