"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tanggalKalenderPanjang } from "@/lib/format";
import { PARAM_HARI_INI, SEMUA } from "@/lib/papan-tanggal";
import { geserTanggal, tanggalSah } from "@/lib/validasi-tugas";

/**
 * Pemilih papan tugas: Semua (bawaan) · Kemarin · Hari ini · Besok,
 * mundur/maju sehari, dan kalender untuk tanggal lain.
 *
 * "Semua" menampilkan yang belum selesai dari semua tanggal, urut dari
 * deadline terdekat; sebuah tanggal menampilkan yang deadline-nya jatuh
 * di tanggal itu. Pilihannya disimpan di URL (`?tanggal=`), sama seperti
 * pilihan tampilan: tautan yang dibagikan membuka papan yang sama, dan
 * papan disaring di server tanpa menunggu klien. Papan Semua tidak
 * ditulis ke URL supaya alamat bawaan halaman tetap pendek; hari ini
 * ditulis `hari-ini`, bukan tanggalnya, supaya tautannya tetap berarti
 * hari ini esok hari.
 *
 * Di layar 375px semuanya tetap satu baris: pintasannya yang digulir
 * mendatar, bukan barisnya yang bertambah.
 */
export function StripTanggal({
  tanggal,
  hariIni,
}: {
  /** Tanggal papan (WIB), atau "semua". */
  tanggal: string;
  hariIni: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [memuat, mulai] = useTransition();

  const semua = tanggal === SEMUA;
  // Panah dari papan Semua melangkah dari hari ini.
  const acuan = semua ? hariIni : tanggal;

  const pindah = (ke: string) => {
    if (ke === tanggal || (ke !== SEMUA && !tanggalSah(ke))) return;
    const baru = new URLSearchParams(params.toString());
    if (ke === SEMUA) baru.delete("tanggal");
    else baru.set("tanggal", ke === hariIni ? PARAM_HARI_INI : ke);

    const query = baru.toString();
    mulai(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  const pintasan = [
    { label: "Semua", nilai: SEMUA },
    { label: "Kemarin", nilai: geserTanggal(hariIni, -1) },
    { label: "Hari ini", nilai: hariIni },
    { label: "Besok", nilai: geserTanggal(hariIni, 1) },
  ];

  const tombolPanah =
    "tekan-halus flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground";

  return (
    <section aria-label="Deadline papan" className="space-y-2">
      <div>
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          {semua ? (
            <Layers className="size-4 text-muted-foreground" />
          ) : (
            <CalendarDays className="size-4 text-muted-foreground" />
          )}
          {semua ? (
            "Semua deadline"
          ) : (
            <span>
              <span className="font-normal text-muted-foreground">
                Deadline{" "}
              </span>
              {tanggalKalenderPanjang(tanggal)}
            </span>
          )}
          {memuat ? (
            <Loader2
              className="size-3.5 animate-spin text-muted-foreground"
              aria-label="Memuat papan"
            />
          ) : null}
        </h2>
        {semua ? (
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Semua yang belum selesai, urut dari deadline terdekat. Kolom
            Selesai: 7 hari terakhir.
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => pindah(geserTanggal(acuan, -1))}
          aria-label="Hari sebelumnya"
          className={tombolPanah}
        >
          <ChevronLeft className="size-4" />
        </button>

        <div
          role="group"
          aria-label="Pilihan papan"
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
            tanggal bawaan ponsel, dan pintasannya muat tanpa digulir. */}
        <label className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle focus-within:ring-2 focus-within:ring-ring/40 sm:hidden">
          <CalendarDays className="size-4" />
          <input
            type="date"
            value={semua ? "" : tanggal}
            onChange={(e) => pindah(e.target.value)}
            aria-label="Pilih tanggal deadline"
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <input
          type="date"
          value={semua ? "" : tanggal}
          onChange={(e) => pindah(e.target.value)}
          aria-label="Pilih tanggal deadline"
          className="tabular hidden h-9 w-[8.75rem] shrink-0 rounded-full bg-card px-3 text-[13px] ring-1 ring-border-subtle outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:block"
        />

        <button
          type="button"
          onClick={() => pindah(geserTanggal(acuan, 1))}
          aria-label="Hari berikutnya"
          className={tombolPanah}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </section>
  );
}
