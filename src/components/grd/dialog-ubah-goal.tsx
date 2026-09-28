"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";
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
  siapSimpanGoal,
  type NilaiGoal,
} from "@/components/grd/form-goal";
import { ubahGoal } from "@/app/actions/goal";
import { tebakModeTarget } from "@/lib/goal";
import type { PilihanGoal, SimpulGoal } from "@/lib/data/goal";

/** Isi awal formulir dari goal yang tersimpan. */
function dariGoal(goal: SimpulGoal, acuan: string): NilaiGoal {
  const mode = tebakModeTarget(goal.bulan, goal.targetGoal);
  return {
    judul: goal.judul,
    level: goal.level,
    pemilikId: goal.pemilikId,
    indukId: goal.parentId,
    unitId: goal.unitId,
    akunId: goal.akunId,
    base: goal.targetBase,
    target: goal.targetGoal,
    stretch: goal.targetStretch,
    mulai: goal.mulai ?? `${acuan.slice(0, 7)}-01`,
    jumlahBulan: Math.max(1, goal.jumlahBulan),
    mode: mode === "kustom" ? "bulanan" : mode,
  };
}

/**
 * Mengubah goal yang sudah dibuat: judul, level, pemilik, induk, periode,
 * dan targetnya. Semua perubahan meninggalkan jejak (audit goal).
 *
 * Anak tangga bulanan disusun ulang hanya bila periode, target goal, atau
 * cara baca targetnya berubah. Memperbaiki salah ketik di judul tidak
 * boleh meratakan anak tangga yang sengaja dibuat berbeda tiap bulan.
 */
export function DialogUbahGoal({
  goal,
  pilihan,
  acuan,
  kecualiInduk,
}: {
  goal: SimpulGoal;
  pilihan: PilihanGoal;
  acuan: string;
  /** Goal ini dan seluruh turunannya: tidak boleh menjadi induknya. */
  kecualiInduk: string[];
}) {
  const [buka, setBuka] = useState(false);
  const [nilai, setNilai] = useState<NilaiGoal>(() => dariGoal(goal, acuan));
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const awal = dariGoal(goal, acuan);
  const kustom =
    goal.jumlahBulan > 1 &&
    tebakModeTarget(goal.bulan, goal.targetGoal) === "kustom";

  const aturUlangBulan =
    goal.jumlahBulan === 0 ||
    nilai.mulai !== awal.mulai ||
    nilai.jumlahBulan !== awal.jumlahBulan ||
    nilai.target !== awal.target ||
    (nilai.jumlahBulan > 1 && nilai.mode !== awal.mode);

  const ubah = (sebagian: Partial<NilaiGoal>) =>
    setNilai((n) => ({ ...n, ...sebagian }));
  const siap = siapSimpanGoal(nilai);

  const bukaTutup = (b: boolean) => {
    // Setiap kali dibuka, isinya mengikuti data terbaru goal ini.
    if (b) {
      setNilai(dariGoal(goal, acuan));
      setPesan(null);
    }
    setBuka(b);
  };

  const simpan = () => {
    if (!siap || menyimpan || !nilai.pemilikId) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await ubahGoal({
        goalId: goal.id,
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
        mulaiBulan: nilai.mulai,
        jumlahBulan: nilai.jumlahBulan,
        modeTarget: nilai.jumlahBulan > 1 ? nilai.mode : "bulanan",
        aturUlangBulan,
      });

      if (hasil.ok) {
        setBuka(false);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={bukaTutup}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Ubah goal ${goal.judul}`}
          className="tekan-halus h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold"
        >
          <Pencil className="size-3" />
          Ubah
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ubah goal</DialogTitle>
          <DialogDescription>
            Perbaiki isian yang keliru. Setiap perubahan tercatat di jejak goal.
          </DialogDescription>
        </DialogHeader>

        <FormGoal
          awalan={`ubah-${goal.id}`}
          nilai={nilai}
          ubah={ubah}
          pilihan={pilihan}
          acuan={acuan}
          kecualiInduk={kecualiInduk}
          pratinjauBulan={aturUlangBulan ? undefined : goal.bulan}
          catatanBulan={
            aturUlangBulan
              ? goal.jumlahBulan > 0
                ? "Anak tangga akan disusun ulang mengikuti periode dan target baru."
                : null
              : kustom
                ? "Anak tangga goal ini berbeda tiap bulan dan tidak diubah, kecuali periode atau targetnya Anda ganti."
                : "Anak tangga tidak berubah."
          }
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
            {menyimpan ? "Menyimpan…" : "Simpan perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
