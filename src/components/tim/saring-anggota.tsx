"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { URUTAN_PERAN } from "@/lib/peran";
import type { SaringanAnggota } from "@/lib/saring-anggota";

/**
 * Pencarian & saringan anggota, disimpan di URL.
 *
 * Dengan begitu hasilnya bisa dibagikan, tombol kembali bekerja seperti
 * biasa, dan penyaringan tetap dikerjakan di server — daftar 25 orang
 * tidak perlu dikirim seluruhnya lalu disaring di browser.
 */
export function SaringAnggota({
  saringan,
  unit,
  departemen,
  program,
  jumlah,
  total,
}: {
  saringan: SaringanAnggota;
  unit: string[];
  departemen: string[];
  program: string[];
  jumlah: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [kata, setKata] = useState(saringan.cari);
  const [cariTerakhir, setCariTerakhir] = useState(saringan.cari);
  const jeda = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Saat URL berubah dari luar (tombol kembali, tautan), kotak ikut selaras.
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

  // Mengetik tidak langsung memuat ulang; jeda singkat menahan satu
  // permintaan per huruf.
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

  const adaSaringan =
    saringan.cari !== "" ||
    saringan.peran !== "semua" ||
    saringan.unit !== "semua" ||
    saringan.departemen !== "semua" ||
    saringan.program !== "semua" ||
    saringan.status !== "semua";

  // Satu baris pil untuk tiap sumbu penempatan; baris dengan satu pilihan
  // saja tidak ditampilkan karena tidak menyaring apa pun.
  const barisPil = (
    kunci: "departemen" | "program",
    labelSemua: string,
    daftar: string[],
  ) =>
    daftar.length > 0 ? (
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {pil(
          saringan[kunci] === "semua",
          labelSemua,
          () => pindah({ [kunci]: "semua" }),
          `${kunci}-semua`,
        )}
        {daftar.map((d) =>
          pil(
            saringan[kunci] === d,
            d,
            () => pindah({ [kunci]: d }),
            `${kunci}-${d}`,
          ),
        )}
      </div>
    ) : null;

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
            aria-label="Cari anggota"
            placeholder="Cari nama, jabatan, atau email"
            className="h-12 w-full rounded-xl bg-muted pr-4 pl-11 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {pil(
            saringan.peran === "semua",
            "Semua peran",
            () => pindah({ peran: "semua" }),
            "peran-semua",
          )}
          {URUTAN_PERAN.map((p) =>
            pil(
              saringan.peran === p,
              p,
              () => pindah({ peran: p }),
              `peran-${p}`,
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

        {barisPil("departemen", "Semua departemen", departemen)}
        {barisPil("program", "Semua program", program)}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            {pil(
              saringan.status === "semua",
              "Semua status",
              () => pindah({ status: "semua" }),
              "status-semua",
            )}
            {pil(
              saringan.status === "aktif",
              "Aktif",
              () => pindah({ status: "aktif" }),
              "status-aktif",
            )}
            {pil(
              saringan.status === "nonaktif",
              "Nonaktif",
              () => pindah({ status: "nonaktif" }),
              "status-nonaktif",
            )}
          </div>

          {adaSaringan ? (
            <button
              type="button"
              onClick={() => {
                if (jeda.current) clearTimeout(jeda.current);
                setKata("");
                pindah({
                  cari: "",
                  peran: "semua",
                  unit: "semua",
                  departemen: "semua",
                  program: "semua",
                  status: "semua",
                });
              }}
              className="tekan-halus sentuh-nyaman inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] leading-[14px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
              Bersihkan
            </button>
          ) : null}
        </div>

        {adaSaringan ? (
          <p
            aria-live="polite"
            className="text-[11px] leading-[14px] text-muted-foreground"
          >
            {jumlah} dari {total} anggota cocok.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
