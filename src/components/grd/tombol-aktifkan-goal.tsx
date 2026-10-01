"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
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
import { aktifkanGoal } from "@/app/actions/goal";

/**
 * Mengesahkan goal usulan. File GRD menandai sebagian target sebagai
 * usulan yang difinalkan di WRM; begitu disahkan, targetnya mulai dipakai
 * laporan harian, ringkasan unit, dan kurva.
 */
export function TombolAktifkanGoal({
  goalId,
  judul,
}: {
  goalId: string;
  judul: string;
}) {
  const [buka, setBuka] = useState(false);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const sahkan = () => {
    if (menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await aktifkanGoal(goalId);
      if (hasil.ok) {
        setBuka(false);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  return (
    <Dialog
      open={buka}
      onOpenChange={(b) => {
        setBuka(b);
        if (b) setPesan(null);
      }}
    >
      <Button
        type="button"
        variant="outline"
        onClick={() => setBuka(true)}
        className="tekan-halus h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold"
      >
        <CheckCircle2 className="size-3.5" />
        Sahkan
      </Button>

      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sahkan usulan ini?</DialogTitle>
          <DialogDescription className="text-pretty">
            &ldquo;{judul}&rdquo; menjadi goal aktif: targetnya mulai dipakai
            laporan harian dan ringkasan unit.
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
            disabled={menyimpan}
            onClick={sahkan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            {menyimpan ? "Menyimpan…" : "Sahkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
