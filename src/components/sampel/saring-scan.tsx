"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaringanScan } from "@/lib/saring-sampel";

const JENIS: { nilai: SaringanScan["jenis"]; label: string }[] = [
  { nilai: "semua", label: "Semua" },
  { nilai: "dikenali", label: "Dikenali" },
  { nilai: "asing", label: "Kode asing" },
];

/**
 * Saringan riwayat pemindaian, disimpan di URL dengan awalan `scan_`.
 *
 * Awalannya sendiri supaya menyaring pemindaian tidak ikut menggeser
 * saringan riwayat perpindahan yang ada di halaman yang sama.
 */
export function SaringScan({
  saringan,
  jumlah,
  total,
}: {
  saringan: SaringanScan;
  jumlah: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [kata, setKata] = useState(saringan.cari);
  const [terakhir, setTerakhir] = useState(saringan.cari);
  const jeda = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (terakhir !== saringan.cari) {
    setTerakhir(saringan.cari);
    setKata(saringan.cari);
  }

  const pindah = (ubah: Record<string, string>) => {
    const baru = new URLSearchParams(params.toString());
    for (const [kunci, nilai] of Object.entries(ubah)) {
      if (!nilai || nilai === "semua") baru.delete(kunci);
      else baru.set(kunci, nilai);
    }
    const query = baru.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const ketik = (nilai: string) => {
    setKata(nilai);
    if (jeda.current) clearTimeout(jeda.current);
    jeda.current = setTimeout(() => pindah({ scan_cari: nilai }), 250);
  };

  const aktif =
    saringan.cari !== "" ||
    saringan.jenis !== "semua" ||
    saringan.dari !== "" ||
    saringan.sampai !== "";

  return (
    <div className="space-y-2 px-5">
      <div className="relative">
        <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={kata}
          onChange={(e) => ketik(e.target.value)}
          maxLength={60}
          autoComplete="off"
          aria-label="Cari pemindaian"
          placeholder="Cari kode, barang, atau pemindainya"
          className="h-11 w-full rounded-xl bg-muted pr-4 pl-11 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {JENIS.map((j) => (
          <button
            key={j.nilai}
            type="button"
            onClick={() => pindah({ scan_jenis: j.nilai })}
            aria-pressed={saringan.jenis === j.nilai}
            className={cn(
              "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold",
              saringan.jenis === j.nilai
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {j.label}
          </button>
        ))}

        <label className="ml-auto flex items-center gap-1.5 text-[11px] leading-[14px] text-muted-foreground">
          <span className="sr-only">Dari tanggal</span>
          <input
            type="date"
            value={saringan.dari}
            onChange={(e) => pindah({ scan_dari: e.target.value })}
            className="h-9 rounded-xl bg-muted px-2.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <span aria-hidden>–</span>
          <span className="sr-only">Sampai tanggal</span>
          <input
            type="date"
            value={saringan.sampai}
            onChange={(e) => pindah({ scan_sampai: e.target.value })}
            className="h-9 rounded-xl bg-muted px-2.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>
      </div>

      <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] leading-[14px] text-muted-foreground">
        <span>
          {aktif ? `${jumlah} dari ${total} pemindaian` : `${total} pemindaian`}
        </span>
        {aktif ? (
          <button
            type="button"
            onClick={() => {
              if (jeda.current) clearTimeout(jeda.current);
              setKata("");
              pindah({
                scan_cari: "",
                scan_jenis: "semua",
                scan_dari: "",
                scan_sampai: "",
              });
            }}
            className="tekan-halus sentuh-nyaman inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold hover:text-foreground"
          >
            <X className="size-3.5" />
            Hapus saringan
          </button>
        ) : null}
      </p>
    </div>
  );
}
