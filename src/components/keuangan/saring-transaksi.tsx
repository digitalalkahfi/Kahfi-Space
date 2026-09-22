"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  LABEL_JENIS_KELUAR,
  LABEL_STATUS_TRANSAKSI,
  type SaringanTransaksi,
} from "@/lib/keuangan";

/**
 * Saringan transaksi, disimpan di URL.
 *
 * Periode berdiri sendiri karena hampir setiap pertanyaan keuangan
 * berbunyi "bulan ini berapa" — dan jawabannya berubah total begitu
 * rentangnya bergeser.
 */
export function SaringTransaksi({
  saringan,
  unit,
  jumlah,
  total,
}: {
  saringan: SaringanTransaksi;
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
    saringan.arah !== "semua" ||
    saringan.jenis !== "semua" ||
    saringan.unit !== "semua" ||
    saringan.status !== "semua" ||
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
            onChange={(e) => ketik(e.target.value)}
            maxLength={60}
            autoComplete="off"
            aria-label="Cari transaksi"
            placeholder="Cari keterangan, unit, atau akun"
            className="h-12 w-full rounded-xl bg-muted pr-4 pl-11 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {pil(
            saringan.arah === "semua",
            "Semua arah",
            () => pindah({ arah: "semua" }),
            "arah-semua",
          )}
          {pil(
            saringan.arah === "masuk",
            "Masuk",
            () => pindah({ arah: "masuk" }),
            "arah-masuk",
          )}
          {pil(
            saringan.arah === "keluar",
            "Keluar",
            () => pindah({ arah: "keluar" }),
            "arah-keluar",
          )}
          {pil(
            saringan.status === "diajukan",
            LABEL_STATUS_TRANSAKSI.diajukan,
            () =>
              pindah({
                status: saringan.status === "diajukan" ? "semua" : "diajukan",
              }),
            "status-diajukan",
          )}
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {pil(
            saringan.jenis === "semua",
            "Semua jenis",
            () => pindah({ jenis: "semua" }),
            "jenis-semua",
          )}
          {(
            [
              "beban",
              "aset",
              "direct_cost",
              "creator_share",
              "dividen",
            ] as const
          ).map((j) =>
            pil(
              saringan.jenis === j,
              LABEL_JENIS_KELUAR[j],
              () => pindah({ jenis: j }),
              `jenis-${j}`,
            ),
          )}
        </div>

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

        <label className="flex flex-wrap items-center gap-2 text-[11px] leading-[14px] text-muted-foreground">
          <span>Periode</span>
          <input
            type="date"
            value={saringan.dari}
            onChange={(e) => pindah({ dari: e.target.value })}
            aria-label="Dari tanggal"
            className="h-9 rounded-xl bg-muted px-2.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <span aria-hidden>–</span>
          <input
            type="date"
            value={saringan.sampai}
            onChange={(e) => pindah({ sampai: e.target.value })}
            aria-label="Sampai tanggal"
            className="h-9 rounded-xl bg-muted px-2.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>

        <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] leading-[14px] text-muted-foreground">
          <span>
            {aktif ? `${jumlah} dari ${total} transaksi` : `${total} transaksi`}
          </span>
          {aktif ? (
            <button
              type="button"
              onClick={() => {
                if (jeda.current) clearTimeout(jeda.current);
                setKata("");
                pindah({
                  cari: "",
                  arah: "semua",
                  jenis: "semua",
                  unit: "semua",
                  status: "semua",
                  dari: "",
                  sampai: "",
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
