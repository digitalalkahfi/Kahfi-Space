"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
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
import {
  FormGoal,
  nilaiAwalGoal,
  siapSimpanGoal,
  type NilaiGoal,
} from "@/components/grd/form-goal";
import { tambahGoal } from "@/app/actions/goal";
import type { PilihanGoal } from "@/lib/data/goal";

/**
 * Membuat goal baru beserta periodenya (tanggal mulai sampai tanggal
 * selesai) dan anak tangga bulanannya.
 *
 * Induk yang ditawarkan hanya goal yang sah menurut tangga roll-down, jadi
 * penolakan database (0065) tidak perlu dialami pemakai lebih dulu.
 */
export function DialogTambahGoal({
  pilihan,
  acuan,
}: {
  pilihan: PilihanGoal;
  /** Tanggal hari ini; periode bawaannya bulan ini, tanggal 1 sampai akhir. */
  acuan: string;
}) {
  const [buka, setBuka] = useState(false);
  const [nilai, setNilai] = useState<NilaiGoal>(() => nilaiAwalGoal(acuan));
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const ubah = (sebagian: Partial<NilaiGoal>) =>
    setNilai((n) => ({ ...n, ...sebagian }));
  const siap = siapSimpanGoal(nilai);

  const simpan = () => {
    if (!siap || menyimpan || !nilai.pemilikId) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await tambahGoal({
        judul: nilai.judul.trim(),
        level: nilai.level,
        pemilikId: nilai.pemilikId as string,
        indukId: nilai.indukId,
        unitId: nilai.level === "leader" ? nilai.unitId : null,
        akunId: nilai.level === "account" ? nilai.akunId : null,
        satuan: "IDR",
        targetBase: nilai.base,
        targetGoal: nilai.target,
        targetStretch: nilai.stretch,
        mulai: nilai.mulai,
        selesai: nilai.selesai,
        modeTarget: nilai.mode,
      });

      if (hasil.ok) {
        setNilai(nilaiAwalGoal(acuan));
        setBuka(false);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <Plus className="size-3.5" />
          Tambah goal
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Goal baru</DialogTitle>
          <DialogDescription>
            Tentukan tanggal mulai dan tanggal selesainya. Target dipecah
            menjadi anak tangga bulanan begitu goal disimpan.
          </DialogDescription>
        </DialogHeader>

        <FormGoal
          awalan="goal-baru"
          nilai={nilai}
          ubah={ubah}
          pilihan={pilihan}
        />

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
            disabled={!siap || menyimpan}
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            {menyimpan ? "Menyimpan…" : "Simpan goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
