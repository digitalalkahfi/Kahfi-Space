"use client";

import { useTransition } from "react";
import { Check, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tandaiDibaca, tandaiSemuaDibaca } from "@/app/actions/notifikasi";
import { useState } from "react";
import {
  PesanAksi,
  nadaHasil,
  type NadaPesan,
} from "@/components/shared/pesan-aksi";

/** Menandai satu notifikasi; muncul hanya pada yang belum dibaca. */
export function TombolTandaiSatu({ id }: { id: string }) {
  const [menandai, mulai] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      aria-label="Tandai sudah dibaca"
      title="Tandai sudah dibaca"
      disabled={menandai}
      onClick={(e) => {
        // Baris notifikasi seluruhnya adalah tautan; tombol ini duduk di
        // dalamnya dan tidak boleh ikut membuka halamannya.
        e.preventDefault();
        e.stopPropagation();
        mulai(async () => {
          await tandaiDibaca(id);
        });
      }}
      className="tekan-halus sentuh-nyaman size-8 shrink-0 rounded-full p-0"
    >
      {menandai ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Check className="size-3.5" />
      )}
    </Button>
  );
}

/**
 * Menandai semua sekaligus.
 *
 * Tanpa konfirmasi: tidak ada yang hilang, dan meminta persetujuan
 * untuk tindakan yang tidak merusak apa pun hanya melatih orang
 * menekan "ya" tanpa membaca.
 */
export function TombolTandaiSemua({ belumDibaca }: { belumDibaca: number }) {
  const [menandai, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [nada, setNada] = useState<NadaPesan>("netral");

  if (belumDibaca === 0) return null;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={menandai}
        onClick={() =>
          mulai(async () => {
            const hasil = await tandaiSemuaDibaca();
            setNada(nadaHasil(hasil));
            setPesan(hasil.pesan ?? null);
          })
        }
        className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
      >
        {menandai ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <CheckCheck className="size-3.5" />
        )}
        Tandai semua dibaca ({belumDibaca})
      </Button>

      {pesan ? <PesanAksi nada={nada}>{pesan}</PesanAksi> : null}
    </div>
  );
}
