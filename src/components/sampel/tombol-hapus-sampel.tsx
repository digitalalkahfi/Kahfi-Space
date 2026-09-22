"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { hapusSampel } from "@/app/actions/sampel";

/**
 * Menghapus sampel yang salah dibuat.
 *
 * Hanya muncul untuk sampel yang masih di gudang: begitu barangnya pernah
 * berpindah atau dipindai, jejaknya harus tetap ada dan database menolak
 * penghapusannya (0082).
 */
export function TombolHapusSampel({
  sampelId,
  kode,
}: {
  sampelId: string;
  kode: string;
}) {
  const [buka, setBuka] = useState(false);
  const [menghapus, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const hapus = () => {
    if (menghapus) return;
    mulai(async () => {
      const hasil = await hapusSampel(sampelId);
      setPesan(hasil.ok ? null : (hasil.pesan ?? null));
      if (hasil.ok || hasil.kode === "demo") setBuka(false);
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label={`Hapus ${kode}`}
        onClick={() => setBuka(true)}
        className="tekan-halus sentuh-nyaman size-8 shrink-0 rounded-full p-0"
      >
        <Trash2 className="size-3.5" />
      </Button>

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus {kode}?</DialogTitle>
            <DialogDescription>
              Hanya untuk sampel yang salah dibuat dan belum pernah berpindah
              maupun dipindai. Barang yang sudah berjejak sebaiknya ditandai
              hilang atau dikembalikan supaya riwayatnya tetap utuh.
            </DialogDescription>
          </DialogHeader>

          {pesan ? (
            <p
              role="status"
              className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text"
            >
              {pesan}
            </p>
          ) : null}

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
              disabled={menghapus}
              onClick={hapus}
              className="tekan-halus rounded-full"
            >
              {menghapus ? <Loader2 className="size-4 animate-spin" /> : null}
              Hapus sampel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
