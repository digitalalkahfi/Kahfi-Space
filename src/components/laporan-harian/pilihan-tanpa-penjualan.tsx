"use client";

import { PackageX } from "lucide-react";

/**
 * Pernyataan pelapor bahwa hari itu memang tidak ada penjualan. Tanpa
 * centang ini GMV Rp 0 tetap ditolak sebagai lupa diisi (`periksaIsiLaporan`),
 * jadi pelapor tidak perlu mengetik angka palsu untuk mengirim laporannya.
 */
export function PilihanTanpaPenjualan({
  kapan,
  nilai,
  onUbah,
}: {
  /** Mis. "kemarin", "pada Sab, 26 Sep", atau "hari itu". */
  kapan: string;
  nilai: boolean;
  onUbah: (nilai: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-muted/50 p-3 text-[13px] leading-[18px] font-semibold">
      <span className="flex items-center gap-1.5">
        <PackageX className="size-3.5 shrink-0 text-muted-foreground" />
        Tidak ada penjualan {kapan}
      </span>
      <input
        type="checkbox"
        checked={nilai}
        onChange={(e) => onUbah(e.target.checked)}
        className="size-4 shrink-0 accent-primary"
      />
    </label>
  );
}
