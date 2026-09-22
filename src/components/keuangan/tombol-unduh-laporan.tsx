"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  lembarEkspor,
  namaBerkasTanggal,
  unduhExcelBeberapaLembar,
} from "@/lib/ekspor-excel";
import type { BarisLaporan } from "@/lib/keuangan";

/**
 * Mengunduh arus kas dan laba rugi sebagai satu berkas dua lembar.
 *
 * Keduanya dikirim bersama karena selalu dibaca berpasangan: arus kas
 * menjawab "uangnya ke mana", laba rugi menjawab "untungnya berapa".
 */
export function TombolUnduhLaporan({
  cashFlow,
  labaRugi,
  periode,
}: {
  cashFlow: BarisLaporan[];
  labaRugi: BarisLaporan[];
  /** Dipakai pada nama berkas, mis. "2024-10". */
  periode: string;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [gagal, setGagal] = useState(false);

  const kolom = [
    { judul: "Pos", ambil: (b: BarisLaporan) => b.label, lebar: 28 },
    { judul: "Nilai", ambil: (b: BarisLaporan) => b.nilai, lebar: 18 },
    {
      judul: "Keterangan",
      ambil: (b: BarisLaporan) => b.catatan ?? "",
      lebar: 42,
    },
  ];

  const unduh = async () => {
    setSibuk(true);
    setGagal(false);
    try {
      await unduhExcelBeberapaLembar({
        namaBerkas: namaBerkasTanggal(`k-space-laporan-keuangan-${periode}`),
        lembar: [
          lembarEkspor("Arus kas", cashFlow, kolom),
          lembarEkspor("Laba rugi", labaRugi, kolom),
        ],
      });
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
        disabled={sibuk}
        className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
      >
        {sibuk ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        {sibuk ? "Menyiapkan…" : "Unduh laporan"}
      </Button>
      {gagal ? (
        <p role="status" className="text-[11px] leading-[14px] text-warn-text">
          Gagal menyiapkan berkas. Coba lagi.
        </p>
      ) : null}
    </div>
  );
}
