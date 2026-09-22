"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogTransaksi } from "@/components/keuangan/dialog-transaksi";
import type { Transaksi } from "@/lib/keuangan";
import type { PilihanOrganisasi } from "@/lib/types";

/**
 * Membetulkan pengajuan yang belum diputuskan.
 *
 * Hanya muncul selama statusnya masih 'diajukan': setelah ada keputusan,
 * basis data mengunci isinya (migrasi 0097) dan tombol yang pasti ditolak
 * hanya membuat orang menebak-nebak apa yang salah.
 */
export function TombolUbahTransaksi({
  transaksi,
  pilihan,
  saldoKas,
}: {
  transaksi: Transaksi;
  pilihan: PilihanOrganisasi;
  saldoKas: number;
}) {
  const [buka, setBuka] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label={`Betulkan ${transaksi.keterangan}`}
        onClick={() => setBuka(true)}
        className="tekan-halus sentuh-nyaman size-8 shrink-0 rounded-full p-0"
      >
        <Pencil className="size-3.5" />
      </Button>

      <DialogTransaksi
        awal={transaksi}
        pilihan={pilihan}
        saldoKas={saldoKas}
        tanggalBawaan={transaksi.tanggal}
        buka={buka}
        onBuka={setBuka}
      />
    </>
  );
}
