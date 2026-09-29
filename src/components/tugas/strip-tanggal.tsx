"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { tanggalKalenderPanjang } from "@/lib/format";
import { geserTanggal, tanggalSah } from "@/lib/validasi-tugas";

/**
 * Pemilih tanggal papan tugas (D4): mundur/maju sehari, pintasan
 * Kemarin · Hari ini · Besok, dan kalender untuk tanggal lain.
 *
 * Tanggalnya disimpan di URL (`?tanggal=`), sama seperti pilihan
 * tampilan: tautan yang dibagikan membuka tanggal yang sama, dan papan
 * disaring di server tanpa menunggu klien. Hari ini tidak ditulis ke URL
 * supaya alamat bawaan halaman tetap pendek.
 *
 * Di layar 375px semuanya tetap satu baris: pintasannya yang digulir
 * mendatar, bukan barisnya yang bertambah.
 */
export function StripTanggal({
  tanggal,
  hariIni,
}: {
  tanggal: string;
  hariIni: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [memuat, mulai] = useTransition();

  const pindah = (ke: string) => {
    if (!tanggalSah(ke) || ke === tanggal) return;
    const baru = new URLSearchParams(params.toString());
    if (ke === hariIni) baru.delete("tanggal");
    else baru.set("tanggal", ke);

    const query = baru.toString();
    mulai(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  const pintasan = [
    { label: "Kemarin", nilai: geserTanggal(hariIni, -1) },
    { label: "Hari ini", nilai: hariIni },
    { label: "Besok", nilai: geserTanggal(hariIni, 1) },
  ];

  const tombolPanah =
    "tekan-halus flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground";

  return (
    <section aria-label="Tanggal papan" className="space-y-2">
      <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
        <CalendarDays className="size-4 text-muted-foreground" />
        {tanggalKalenderPanjang(tanggal)}
        {memuat ? (
          <Loader2
            className="size-3.5 animate-spin text-muted-foreground"
            aria-label="Memuat tanggal"
          />
        ) : null}
      </h2>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => pindah(geserTanggal(tanggal, -1))}
          aria-label="Hari sebelumnya"
          className={tombolPanah}
        >
          <ChevronLeft className="size-4" />
        </button>

        <div
          role="group"
          aria-label="Pintasan tanggal"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]"
        >
          {pintasan.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => pindah(p.nilai)}
              aria-pressed={tanggal === p.nilai}
              className={cn(
                "tekan-halus sentuh-nyaman shrink-0 rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
                tanggal === p.nilai
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Layar sempit: cukup ikon kalender — isian aslinya dilapiskan
            transparan di atasnya, jadi ketukan tetap membuka pemilih
            tanggal bawaan ponsel, dan ketiga pintasan muat tanpa digulir. */}
        <label className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle focus-within:ring-2 focus-within:ring-ring/40 sm:hidden">
          <CalendarDays className="size-4" />
          <input
            type="date"
            value={tanggal}
            onChange={(e) => pindah(e.target.value)}
            aria-label="Pilih tanggal"
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <input
          type="date"
          value={tanggal}
          onChange={(e) => pindah(e.target.value)}
          aria-label="Pilih tanggal"
          className="tabular hidden h-9 w-[8.75rem] shrink-0 rounded-full bg-card px-3 text-[13px] ring-1 ring-border-subtle outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:block"
        />

        <button
          type="button"
          onClick={() => pindah(geserTanggal(tanggal, 1))}
          aria-label="Hari berikutnya"
          className={tombolPanah}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </section>
  );
}
