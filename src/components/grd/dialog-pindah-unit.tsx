"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { gayaUnit } from "@/lib/unit";
import { DAFTAR_UNIT } from "@/lib/unit-pelaporan";
import { pindahUnitAkun } from "@/app/actions/akun";
import type { AkunKelola } from "@/lib/data/akun";
import type { KodeUnit } from "@/lib/types";

/**
 * Memindahkan akun ke unit lain.
 *
 * Konsekuensinya ditulis apa adanya sebelum disimpan: PIC, co-leader,
 * dan program menempel pada unit lama dan akan terlepas. Itu bukan
 * efek samping yang pantas ditemukan sesudahnya — akun tanpa PIC
 * berhenti melapor, dan tidak ada yang menagihnya.
 */
export function DialogPindahUnit({
  akun,
  buka,
  onBuka,
}: {
  akun: AkunKelola;
  buka: boolean;
  onBuka: (b: boolean) => void;
}) {
  const [pilih, setPilih] = useState<KodeUnit | null>(null);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const kehilangan = [
    akun.picNama ? `PIC ${akun.picNama}` : null,
    akun.coLeaderNama ? `co-leader ${akun.coLeaderNama}` : null,
    akun.program ? `program ${akun.program}` : null,
  ].filter((x) => x !== null);

  const simpan = () => {
    if (menyimpan || pilih === null) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await pindahUnitAkun({ akunId: akun.id, unitKode: pilih });
      if (hasil.ok) {
        onBuka(false);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pindahkan {akun.username}</DialogTitle>
          <DialogDescription>
            Akun ini sekarang di {akun.unitNama}. Unit menentukan siapa yang
            boleh menjadi PIC-nya dan bagaimana laporannya diisi.
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Unit tujuan" className="space-y-1.5">
          {DAFTAR_UNIT.filter((u) => u.kode !== akun.unitKode).map((u) => {
            const aktif = pilih === u.kode;
            return (
              <button
                key={u.kode}
                type="button"
                role="radio"
                aria-checked={aktif}
                onClick={() => setPilih(u.kode)}
                className={cn(
                  "tekan-halus sentuh-nyaman flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left",
                  aktif
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : "bg-muted/50 hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    gayaUnit[u.kode].bar,
                  )}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] leading-[18px] font-semibold">
                    {u.nama}
                  </span>
                  <span className="block text-[11px] leading-[14px] text-pretty text-muted-foreground">
                    Laporan harian diisi per {u.lapor}.
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {pilih !== null && kehilangan.length > 0 ? (
          <p className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-warn-text">
            {kehilangan.join(", ")} akan dilepas — ketiganya menempel pada unit
            lama. Tunjuk ulang setelah pindah, kalau tidak akun ini berhenti
            terlapor.
          </p>
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
            disabled={menyimpan || pilih === null}
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowLeftRight className="size-4" />
            )}
            Pindahkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
