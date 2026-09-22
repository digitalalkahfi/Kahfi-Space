"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type TampilanTugas = "papan" | "daftar";

/**
 * Pemilih tampilan halaman Tugas: papan Kanban atau daftar bertenggat.
 *
 * Pilihannya disimpan di URL, bukan di state komponen — supaya tautan
 * yang dibagikan membuka tampilan yang sama, dan supaya halaman tetap
 * dirender di server tanpa menunggu klien memutuskan.
 */
export function PilihTampilan({ tampilan }: { tampilan: TampilanTugas }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const pindah = (ke: TampilanTugas) => {
    const baru = new URLSearchParams(params.toString());
    if (ke === "papan") baru.delete("tampilan");
    else baru.set("tampilan", ke);

    const query = baru.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const pilihan: { kunci: TampilanTugas; label: string; Ikon: typeof List }[] =
    [
      { kunci: "papan", label: "Papan", Ikon: LayoutGrid },
      { kunci: "daftar", label: "Daftar", Ikon: List },
    ];

  return (
    <div
      role="group"
      aria-label="Tampilan tugas"
      className="flex gap-1 rounded-full bg-muted p-1"
    >
      {pilihan.map(({ kunci, label, Ikon }) => (
        <button
          key={kunci}
          type="button"
          onClick={() => pindah(kunci)}
          aria-pressed={tampilan === kunci}
          className={cn(
            "tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap transition-colors",
            tampilan === kunci
              ? "bg-card text-foreground shadow-card"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Ikon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
