"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaringanProgres } from "@/lib/lms";

/**
 * Saringan daftar progres belajar, disimpan di URL.
 *
 * Saringan "belum tuntas" berdiri sendiri karena itulah daftar yang
 * benar-benar perlu ditindaklanjuti pengelola; sisanya sekadar kabar baik.
 */
export function SaringProgres({
  saringan,
  unit,
  jumlah,
  total,
}: {
  saringan: SaringanProgres;
  unit: string[];
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
    jeda.current = setTimeout(() => pindah({ cari: nilai }), 250);
  };

  const pil = (
    aktif: boolean,
    label: string,
    saatKlik: () => void,
    kunci: string,
  ) => (
    <button
      key={kunci}
      type="button"
      onClick={saatKlik}
      aria-pressed={aktif}
      className={cn(
        "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
        aktif
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  const aktif =
    saringan.cari !== "" ||
    saringan.unit !== "semua" ||
    saringan.hanyaTertinggal;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={kata}
          onChange={(e) => ketik(e.target.value)}
          maxLength={60}
          autoComplete="off"
          aria-label="Cari anggota atau pelatihan"
          placeholder="Cari nama, unit, atau pelatihan yang tertunda"
          className="h-12 w-full rounded-xl bg-muted pr-4 pl-11 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
        {pil(
          saringan.hanyaTertinggal,
          "Belum tuntas",
          () => pindah({ tertinggal: saringan.hanyaTertinggal ? "" : "ya" }),
          "tertinggal",
        )}
        {unit.length > 1
          ? [
              pil(
                saringan.unit === "semua",
                "Semua unit",
                () => pindah({ unit: "semua" }),
                "unit-semua",
              ),
              ...unit.map((u) =>
                pil(
                  saringan.unit === u,
                  u,
                  () => pindah({ unit: u }),
                  `unit-${u}`,
                ),
              ),
            ]
          : null}
      </div>

      <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] leading-[14px] text-muted-foreground">
        <span>
          {aktif ? `${jumlah} dari ${total} anggota` : `${total} anggota`}
        </span>
        {aktif ? (
          <button
            type="button"
            onClick={() => {
              if (jeda.current) clearTimeout(jeda.current);
              setKata("");
              pindah({ cari: "", unit: "semua", tertinggal: "" });
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
