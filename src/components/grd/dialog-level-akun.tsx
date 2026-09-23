"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { bilangan } from "@/lib/format";
import {
  BATAS_MINIMUM_LEVEL,
  batasMinimum,
  LEVEL_MIN,
} from "@/lib/batas-minimum";
import { ubahLevelAkun } from "@/app/actions/akun";
import type { AkunKelola } from "@/lib/data/akun";

const ALASAN_MIN = 10;

/**
 * Dialog ubah level akun.
 *
 * Levelnya menentukan batas minimum unggahan harian PIC-nya, jadi
 * pilihannya ditampilkan bersama angka batasnya — orang yang menaikkan
 * level harus melihat beban yang ia naikkan, bukan sekadar angka level.
 *
 * Alasannya wajib. Jejak perubahan level dibaca berbulan-bulan kemudian
 * untuk menilai kepatuhan masa lalu; jejak tanpa alasan tidak bisa
 * menjelaskan apa pun saat itu.
 */
export function DialogLevelAkun({
  akun,
  buka,
  onBuka,
}: {
  akun: AkunKelola;
  buka: boolean;
  onBuka: (b: boolean) => void;
}) {
  const [pilih, setPilih] = useState<number | null>(akun.level);
  const [alasan, setAlasan] = useState("");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const berubah = pilih !== null && pilih !== akun.level;
  const alasanCukup = alasan.trim().length >= ALASAN_MIN;

  const simpan = () => {
    if (menyimpan || pilih === null) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await ubahLevelAkun({
        akunId: akun.id,
        level: pilih,
        alasan,
      });
      if (hasil.ok) {
        onBuka(false);
        setAlasan("");
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Level {akun.username}</DialogTitle>
          <DialogDescription>
            Level menentukan batas minimum unggahan per hari kerja bagi PIC-nya.
            Saat ini{" "}
            {akun.level === null
              ? "belum ditetapkan"
              : `level ${akun.level} — minimum ${bilangan(akun.minimum ?? 0)} unggahan`}
            .
          </DialogDescription>
        </DialogHeader>

        <div
          role="radiogroup"
          aria-label="Pilih level akun"
          className="grid grid-cols-3 gap-1.5"
        >
          {BATAS_MINIMUM_LEVEL.map((minimum, level) => {
            const aktif = pilih === level;
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={aktif}
                onClick={() => setPilih(level)}
                className={cn(
                  "tekan-halus sentuh-nyaman rounded-2xl px-2 py-2 text-center",
                  aktif
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : "bg-muted/50 hover:bg-muted",
                )}
              >
                <span className="tabular block text-[13px] leading-[18px] font-semibold">
                  Level {level}
                </span>
                <span className="tabular block text-[11px] leading-[14px] text-muted-foreground">
                  min. {bilangan(minimum)}
                </span>
              </button>
            );
          })}
        </div>

        {berubah ? (
          <p className="rounded-xl bg-accentmuted-fill px-3 py-2 text-[11px] leading-[14px] text-accentmuted-text">
            {akun.level === null
              ? `Batas minimum akun ini menjadi ${bilangan(batasMinimum(pilih) ?? 0)} unggahan per hari kerja.`
              : `Batas minimumnya berubah dari ${bilangan(akun.minimum ?? 0)} menjadi ${bilangan(batasMinimum(pilih) ?? 0)} unggahan per hari kerja — beban ${akun.picNama ?? "PIC akun ini"} ikut berubah.`}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="alasan-level">Alasan perubahan</Label>
          <Textarea
            id="alasan-level"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            rows={2}
            placeholder="mis. Naik kelas setelah tiga bulan stabil di atas target"
            aria-describedby="alasan-level-bantuan"
            className="rounded-2xl"
          />
          <p
            id="alasan-level-bantuan"
            className="text-[11px] leading-[14px] text-muted-foreground"
          >
            Tercatat permanen bersama waktu dan pelakunya. Minimal {ALASAN_MIN}{" "}
            karakter.
          </p>
        </div>

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
            disabled={menyimpan || !berubah || !alasanCukup}
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            {menyimpan ? "Menyimpan…" : `Setel level ${pilih ?? LEVEL_MIN}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
