"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PesanAksi,
  nadaHasil,
  type NadaPesan,
} from "@/components/shared/pesan-aksi";
import type { Hasil } from "@/lib/data/hasil";

/**
 * Konfirmasi untuk tindakan yang sulit ditarik kembali.
 *
 * Dipakai bersama supaya kalimatnya seragam: sebut apa yang akan
 * terjadi, bukan "apakah Anda yakin". Orang menekan "ya" pada
 * pertanyaan yang tidak ia baca; ia berhenti pada kalimat yang
 * menyebutkan akibatnya.
 */
export function DialogKonfirmasi({
  pemicu,
  judul,
  pesan,
  labelYa = "Lanjutkan",
  berbahaya = false,
  onSetuju,
}: {
  pemicu: ReactNode;
  judul: string;
  pesan: string;
  labelYa?: string;
  /** Tindakan yang menghapus atau menghentikan sesuatu. */
  berbahaya?: boolean;
  onSetuju: () => Promise<Hasil | void>;
}) {
  const [buka, setBuka] = useState(false);
  const [memproses, mulai] = useTransition();
  const [pesanHasil, setPesanHasil] = useState<string | null>(null);
  const [nada, setNada] = useState<NadaPesan>("netral");

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>{pemicu}</DialogTrigger>

      <DialogContent className="rounded-3xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription>{pesan}</DialogDescription>
        </DialogHeader>

        {pesanHasil ? <PesanAksi nada={nada}>{pesanHasil}</PesanAksi> : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="tekan-halus rounded-full"
            >
              Batal
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={memproses}
            onClick={() =>
              mulai(async () => {
                setPesanHasil(null);
                const hasil = await onSetuju();
                if (hasil && "ok" in hasil) {
                  setNada(nadaHasil(hasil));
                  setPesanHasil(hasil.pesan ?? null);
                  if (hasil.ok) setBuka(false);
                } else {
                  setBuka(false);
                }
              })
            }
            className={cn(
              "tekan-halus rounded-full",
              // Token `--color-danger` dipakai apa adanya; teksnya putih
              // supaya kontrasnya cukup pada merah pekat.
              berbahaya && "bg-danger text-white hover:bg-danger/90",
            )}
          >
            {memproses ? <Loader2 className="size-4 animate-spin" /> : null}
            {labelYa}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
