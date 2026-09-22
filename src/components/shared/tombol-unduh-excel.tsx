"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { unduhExcel, type KolomEkspor } from "@/lib/ekspor-excel";

/**
 * Mengunduh baris yang sedang tampil (sesuai saringan) sebagai .xlsx.
 * Modul SheetJS baru dimuat saat tombol ditekan.
 */
export function TombolUnduhExcel<T>({
  baris,
  kolom,
  namaBerkas,
  namaSheet,
  label = "Unduh Excel",
  className,
}: {
  baris: T[];
  kolom: KolomEkspor<T>[];
  namaBerkas: string;
  namaSheet?: string;
  label?: string;
  className?: string;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [gagal, setGagal] = useState(false);

  const unduh = async () => {
    setSibuk(true);
    setGagal(false);
    try {
      await unduhExcel({ baris, kolom, namaBerkas, namaSheet });
    } catch {
      setGagal(true);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={unduh}
        disabled={sibuk || baris.length === 0}
        className={cn(
          "tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold",
          className,
        )}
      >
        {sibuk ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        {sibuk ? "Menyiapkan…" : `${label} (${baris.length})`}
      </Button>
      {gagal ? (
        <span
          role="status"
          className="text-[11px] leading-[14px] text-danger-text"
        >
          Gagal menyiapkan berkas. Coba lagi.
        </span>
      ) : null}
    </div>
  );
}
