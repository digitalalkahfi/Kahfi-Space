"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LABEL_STATUS_SAMPEL, type StatusSampel } from "@/lib/sampel";
import type { SaringanRiwayat } from "@/lib/saring-sampel";

const STATUS: StatusSampel[] = [
  "tersedia",
  "dipegang",
  "dikirim",
  "diterima",
  "dikembalikan",
  "hilang",
];

/** Pencarian & saringan riwayat, disimpan di URL agar bisa dibagikan. */
export function SaringRiwayat({
  saringan,
  unit,
  jumlah,
  total,
}: {
  saringan: SaringanRiwayat;
  unit: string[];
  jumlah: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [kata, setKata] = useState(saringan.cari);
  const [cariTerakhir, setCariTerakhir] = useState(saringan.cari);
  const jeda = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (cariTerakhir !== saringan.cari) {
    setCariTerakhir(saringan.cari);
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

  const ada =
    saringan.cari !== "" ||
    saringan.status !== "semua" ||
    saringan.unit !== "semua" ||
    saringan.dari !== "" ||
    saringan.sampai !== "";

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-3 px-5">
        <div className="relative">
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={kata}
            maxLength={60}
            autoComplete="off"
            aria-label="Cari riwayat sampel"
            onChange={(e) => ketik(e.target.value)}
            placeholder="Cari kode, barang, orang, atau kreator"
            className="h-12 w-full rounded-xl bg-muted pr-4 pl-11 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {pil(
            saringan.status === "semua",
            "Semua keadaan",
            () => pindah({ status: "semua" }),
            "st-semua",
          )}
          {STATUS.map((s) =>
            pil(
              saringan.status === s,
              LABEL_STATUS_SAMPEL[s],
              () => pindah({ status: s }),
              `st-${s}`,
            ),
          )}
        </div>

        {unit.length > 1 ? (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {pil(
              saringan.unit === "semua",
              "Semua unit",
              () => pindah({ unit: "semua" }),
              "un-semua",
            )}
            {unit.map((u) =>
              pil(saringan.unit === u, u, () => pindah({ unit: u }), `un-${u}`),
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <label
              htmlFor="dari-riwayat"
              className="text-[11px] leading-[14px] font-semibold text-muted-foreground"
            >
              Dari tanggal
            </label>
            <input
              id="dari-riwayat"
              type="date"
              value={saringan.dari}
              onChange={(e) => pindah({ dari: e.target.value })}
              className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <label
              htmlFor="sampai-riwayat"
              className="text-[11px] leading-[14px] font-semibold text-muted-foreground"
            >
              Sampai
            </label>
            <input
              id="sampai-riwayat"
              type="date"
              value={saringan.sampai}
              onChange={(e) => pindah({ sampai: e.target.value })}
              className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        </div>

        {ada ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              aria-live="polite"
              className="text-[11px] leading-[14px] text-muted-foreground"
            >
              {jumlah} dari {total} perpindahan cocok.
            </p>
            <button
              type="button"
              onClick={() => {
                if (jeda.current) clearTimeout(jeda.current);
                setKata("");
                pindah({
                  cari: "",
                  status: "semua",
                  unit: "semua",
                  dari: "",
                  sampai: "",
                });
              }}
              className="tekan-halus sentuh-nyaman inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] leading-[14px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
              Bersihkan
            </button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
