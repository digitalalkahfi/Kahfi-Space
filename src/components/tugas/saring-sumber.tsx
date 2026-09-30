"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LABEL_LIHAT, type LihatTugas } from "@/lib/sumber-tugas";

/**
 * Baris pilihan "Semua · To-do pribadi · Dari atasan · Untuk bawahan ·
 * Tim lain" di atas papan dan daftar tugas.
 *
 * Pilihannya ditulis ke URL (`?lihat=`) seperti tanggal dan tampilan,
 * jadi ikut terbawa saat berpindah tanggal atau antara Papan dan Daftar.
 * Bedanya, ia ditulis lewat history peramban tanpa memuat ulang halaman:
 * isinya sudah ada di layar, hanya disaring.
 *
 * Di layar sempit barisnya digulir mendatar, bukan bertambah baris.
 */
export function SaringSumber({
  pilihan,
  aktif,
  jumlah,
}: {
  pilihan: LihatTugas[];
  aktif: LihatTugas;
  jumlah: Record<LihatTugas, number>;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const baris = useRef<HTMLDivElement>(null);

  // Di ponsel barisnya lebih lebar dari layar: pilihan yang aktif — mis.
  // dari tautan `?lihat=tim` — digeser ke dalam pandangan, supaya orang
  // tahu saringan apa yang sedang berlaku.
  useEffect(() => {
    const wadah = baris.current;
    const tombol = wadah?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!wadah || !tombol) return;
    const kiri = tombol.offsetLeft - wadah.offsetLeft;
    if (
      kiri < wadah.scrollLeft ||
      kiri + tombol.offsetWidth > wadah.scrollLeft + wadah.clientWidth
    ) {
      wadah.scrollTo({ left: Math.max(0, kiri - 16) });
    }
  }, [aktif]);

  const pilih = (ke: LihatTugas) => {
    if (ke === aktif) return;
    const baru = new URLSearchParams(params.toString());
    if (ke === "semua") baru.delete("lihat");
    else baru.set("lihat", ke);

    const query = baru.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${pathname}?${query}` : pathname,
    );
  };

  return (
    <div
      ref={baris}
      role="group"
      aria-label="Saring tugas"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0"
    >
      {pilihan.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => pilih(k)}
          aria-pressed={k === aktif}
          className={cn(
            "tekan-halus sentuh-nyaman flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
            k === aktif
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
          )}
        >
          {LABEL_LIHAT[k]}
          <span
            className={cn(
              "tabular rounded-full px-1.5 text-[10px] leading-[14px]",
              k === aktif
                ? "bg-primary-foreground/20"
                : "bg-muted text-muted-foreground",
            )}
          >
            {jumlah[k]}
          </span>
        </button>
      ))}
    </div>
  );
}
