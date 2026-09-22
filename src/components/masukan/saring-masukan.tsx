"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  GAYA_JENIS,
  GAYA_KEPARAHAN,
  LABEL_JENIS,
  LABEL_KEPARAHAN,
  LABEL_STATUS_MASUKAN,
  masukanTersaring,
  type JenisMasukan,
  type Keparahan,
  type SaringanMasukan,
  type StatusMasukan,
} from "@/lib/masukan";

const JENIS: JenisMasukan[] = ["bug", "saran", "pertanyaan"];
const STATUS: StatusMasukan[] = [
  "baru",
  "ditinjau",
  "dikerjakan",
  "selesai",
  "ditolak",
];
const KEPARAHAN: Keparahan[] = ["ringan", "sedang", "berat", "kritis"];

/** Pencarian & saringan masukan, disimpan di URL agar bisa dibagikan. */
export function SaringMasukan({
  saringan,
  jumlah,
  total,
}: {
  saringan: SaringanMasukan;
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
    gaya?: string,
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
          : (gaya ?? "bg-muted text-muted-foreground hover:text-foreground"),
      )}
    >
      {label}
    </button>
  );

  const ada = masukanTersaring(saringan);

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
            aria-label="Cari masukan"
            onChange={(e) => ketik(e.target.value)}
            placeholder="Cari judul, isi, pelapor, atau halaman"
            className="h-12 w-full rounded-xl bg-muted pr-4 pl-11 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {pil(
            saringan.jenis === "semua",
            "Semua jenis",
            () => pindah({ jenis: "semua" }),
            "j-semua",
          )}
          {JENIS.map((j) =>
            pil(
              saringan.jenis === j,
              LABEL_JENIS[j],
              () => pindah({ jenis: j }),
              `j-${j}`,
              GAYA_JENIS[j],
            ),
          )}
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {pil(
            saringan.status === "semua",
            "Semua status",
            () => pindah({ status: "semua" }),
            "s-semua",
          )}
          {pil(
            saringan.status === "terbuka",
            "Belum tuntas",
            () => pindah({ status: "terbuka" }),
            "s-terbuka",
          )}
          {STATUS.map((s) =>
            pil(
              saringan.status === s,
              LABEL_STATUS_MASUKAN[s],
              () => pindah({ status: s }),
              `s-${s}`,
            ),
          )}
        </div>

        {saringan.jenis === "bug" ? (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {pil(
              saringan.keparahan === "semua",
              "Semua keparahan",
              () => pindah({ keparahan: "semua" }),
              "k-semua",
            )}
            {KEPARAHAN.map((k) =>
              pil(
                saringan.keparahan === k,
                LABEL_KEPARAHAN[k],
                () => pindah({ keparahan: k }),
                `k-${k}`,
                GAYA_KEPARAHAN[k],
              ),
            )}
          </div>
        ) : null}

        {ada ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              aria-live="polite"
              className="text-[11px] leading-[14px] text-muted-foreground"
            >
              {jumlah} dari {total} masukan cocok.
            </p>
            <button
              type="button"
              onClick={() => {
                if (jeda.current) clearTimeout(jeda.current);
                setKata("");
                pindah({
                  cari: "",
                  jenis: "semua",
                  status: "semua",
                  keparahan: "semua",
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
