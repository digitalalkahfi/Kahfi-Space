"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  LABEL_STATUS_PENJUAL,
  penjualTersaring,
  type SaringanPenjual,
} from "@/lib/penjual";

const STATUS: { nilai: SaringanPenjual["status"]; label: string }[] = [
  { nilai: "semua", label: "Semua" },
  { nilai: "aktif", label: LABEL_STATUS_PENJUAL.aktif },
  { nilai: "prospek", label: LABEL_STATUS_PENJUAL.prospek },
  { nilai: "nonaktif", label: LABEL_STATUS_PENJUAL.nonaktif },
];

/** Saringan daftar mitra, disimpan di URL supaya bisa dibagikan. */
export function SaringPenjual({
  saringan,
  unit,
  kategori,
  jumlah,
  total,
}: {
  saringan: SaringanPenjual;
  unit: string[];
  kategori: string[];
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

  const aktif = penjualTersaring(saringan);

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-3 px-5">
        <div className="relative">
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={kata}
            onChange={(e) => ketik(e.target.value)}
            maxLength={60}
            autoComplete="off"
            aria-label="Cari mitra"
            placeholder="Cari toko, kontak, kategori, atau catatan"
            className="h-12 w-full rounded-xl bg-muted pr-4 pl-11 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {STATUS.map((s) =>
            pil(
              saringan.status === s.nilai,
              s.label,
              () => pindah({ status: s.nilai }),
              `status-${s.nilai}`,
            ),
          )}
        </div>

        {kategori.length > 1 ? (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {pil(
              saringan.kategori === "semua",
              "Semua kategori",
              () => pindah({ kategori: "semua" }),
              "kategori-semua",
            )}
            {kategori.map((k) =>
              pil(
                saringan.kategori === k,
                k,
                () => pindah({ kategori: k }),
                `kategori-${k}`,
              ),
            )}
          </div>
        ) : null}

        {unit.length > 1 ? (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {pil(
              saringan.unit === "semua",
              "Semua unit",
              () => pindah({ unit: "semua" }),
              "unit-semua",
            )}
            {unit.map((u) =>
              pil(
                saringan.unit === u,
                u,
                () => pindah({ unit: u }),
                `unit-${u}`,
              ),
            )}
          </div>
        ) : null}

        <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] leading-[14px] text-muted-foreground">
          <span>
            {aktif ? `${jumlah} dari ${total} mitra` : `${total} mitra`}
          </span>
          {aktif ? (
            <button
              type="button"
              onClick={() => {
                if (jeda.current) clearTimeout(jeda.current);
                setKata("");
                pindah({
                  cari: "",
                  status: "semua",
                  unit: "semua",
                  kategori: "semua",
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
    </Card>
  );
}
