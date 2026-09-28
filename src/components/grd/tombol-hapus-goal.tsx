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
import { dampakHapusGoal, hapusGoal } from "@/app/actions/goal";
import { kalimatDampakHapus, type DampakHapusGoal } from "@/lib/goal";

/**
 * Menghapus goal yang salah dibuat atau tidak dipakai lagi.
 *
 * Sebelum orang memutuskan, dialog menyebut satu per satu apa yang ikut
 * terdampak — anak tangga, lead measure beserta catatannya, goal turunan,
 * dan komitmen mingguan — karena penghapusan tidak bisa dibatalkan.
 */
export function TombolHapusGoal({
  goalId,
  judul,
}: {
  goalId: string;
  judul: string;
}) {
  const [buka, setBuka] = useState(false);
  const [dampak, setDampak] = useState<DampakHapusGoal | null>(null);
  const [memeriksa, mulaiPeriksa] = useTransition();
  const [menghapus, mulaiHapus] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const bukaTutup = (b: boolean) => {
    setBuka(b);
    if (!b) return;
    // Dampaknya selalu dihitung ulang: data bisa berubah sejak terakhir dibuka.
    setDampak(null);
    setPesan(null);
    mulaiPeriksa(async () => {
      const hasil = await dampakHapusGoal(goalId);
      if (hasil.ok) setDampak(hasil.data);
      else setPesan(hasil.pesan);
    });
  };

  const hapus = () => {
    if (!dampak || menghapus) return;
    setPesan(null);
    mulaiHapus(async () => {
      const hasil = await hapusGoal(goalId);
      if (hasil.ok) {
        setBuka(false);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={bukaTutup}>
      <Button
        type="button"
        variant="outline"
        aria-label={`Hapus goal ${judul}`}
        onClick={() => bukaTutup(true)}
        className="tekan-halus size-8 shrink-0 rounded-full p-0 text-muted-foreground hover:text-danger-text"
      >
        <Trash2 className="size-3.5" />
      </Button>

      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hapus goal ini?</DialogTitle>
          <DialogDescription className="text-pretty">
            &ldquo;{judul}&rdquo; akan dihapus permanen dan tidak bisa
            dikembalikan.
          </DialogDescription>
        </DialogHeader>

        {memeriksa ? (
          <p className="flex items-center gap-2 text-[13px] leading-[18px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Memeriksa data yang terkait…
          </p>
        ) : dampak ? (
          <ul className="space-y-1.5 rounded-2xl bg-muted/60 px-4 py-3 text-[13px] leading-[18px]">
            {kalimatDampakHapus(dampak).map((k) => (
              <li
                key={k}
                className="list-disc text-pretty marker:text-muted-foreground ml-4"
              >
                {k}
              </li>
            ))}
          </ul>
        ) : null}

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
            variant="destructive"
            disabled={!dampak || memeriksa || menghapus}
            onClick={hapus}
            className="tekan-halus rounded-full"
          >
            {menghapus ? <Loader2 className="size-4 animate-spin" /> : null}
            {menghapus ? "Menghapus…" : "Hapus goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
