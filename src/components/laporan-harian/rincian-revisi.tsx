import { ArrowRight } from "lucide-react";
import { bilangan, rupiahPenuh } from "@/lib/format";
import { LABEL_KOLOM, perubahanRevisi } from "@/lib/laporan";
import { cn } from "@/lib/utils";
import type { RevisiLaporan } from "@/lib/types";

/**
 * Angka apa saja yang berubah pada satu perbaikan. Dipakai dialog revisi
 * dan halaman detail supaya keduanya membaca jejak yang sama persis —
 * bukan dua tafsiran atas baris yang sama.
 */
export function RincianRevisi({
  revisi,
  className,
}: {
  revisi: RevisiLaporan;
  className?: string;
}) {
  const perubahan = perubahanRevisi(revisi);

  if (perubahan.length === 0) {
    return (
      <p className={cn("text-[13px] leading-[18px]", className)}>
        Tidak ada angka yang berubah.
      </p>
    );
  }

  return (
    <ul className={cn("space-y-0.5", className)}>
      {perubahan.map((p) => (
        <li
          key={p.kolom}
          className="tabular flex flex-wrap items-center gap-1.5 text-[13px] leading-[18px] font-semibold"
        >
          {p.kolom !== "gmv" ? (
            <span className="font-normal text-muted-foreground">
              {LABEL_KOLOM[p.kolom]}
            </span>
          ) : null}
          {p.kolom === "jumlahUpload" ? bilangan(p.dari) : rupiahPenuh(p.dari)}
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
          {p.kolom === "jumlahUpload" ? bilangan(p.ke) : rupiahPenuh(p.ke)}
        </li>
      ))}
    </ul>
  );
}
