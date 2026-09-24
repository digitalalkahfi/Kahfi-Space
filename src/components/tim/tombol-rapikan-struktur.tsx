"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { rapikanStruktur } from "@/app/actions/anggota";
import { bilangan } from "@/lib/format";
import type { PeriksaStruktur } from "@/lib/atasan";

/**
 * Menyambungkan garis pelaporan yang kosong atau melanggar aturan ke
 * atasan yang sesuai — hanya yang usulannya tunggal.
 *
 * Perubahannya diperlihatkan satu per satu sebelum disimpan: atasan
 * menentukan siapa menyetujui izin dan menerima laporan, jadi tidak ada
 * yang boleh berpindah tanpa terlihat oleh yang menekan tombolnya.
 */
export function TombolRapikanStruktur({
  periksa,
}: {
  periksa: PeriksaStruktur;
}) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const terapkan = () => {
    setPesan(null);
    mulai(async () => {
      const hasil = await rapikanStruktur();
      if (hasil.ok) {
        setBuka(false);
        router.refresh();
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
          <Wand2 className="size-3.5" />
          Rapikan garis pelaporan
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rapikan garis pelaporan</DialogTitle>
          <DialogDescription>
            Atasan yang sudah sesuai aturan tidak disentuh. Yang kosong atau
            melanggar aturan disambungkan ke atasan berikut, lalu diperiksa
            ulang sampai tidak ada lagi yang bisa disambungkan.
          </DialogDescription>
        </DialogHeader>

        {periksa.ubah.length > 0 ? (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {periksa.ubah.map((u) => (
              <li
                key={u.id}
                className="rounded-2xl bg-muted/50 px-3 py-2 text-[12px] leading-[16px]"
              >
                <p className="font-semibold">
                  {u.nama}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {u.role}
                  </span>
                </p>
                <p className="flex flex-wrap items-center gap-1 text-muted-foreground">
                  <span>{u.dari ?? "belum punya atasan"}</span>
                  <ArrowRight className="size-3" aria-hidden />
                  <span className="font-medium text-foreground">
                    {u.ke
                      ? `${u.ke.nama} (${u.ke.role})`
                      : "dilepas — CEO tidak punya atasan"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-muted px-3 py-2 text-[12px] leading-[16px] text-muted-foreground">
            Tidak ada yang bisa disambungkan otomatis.
          </p>
        )}

        {periksa.butuhKeputusan.length > 0 ? (
          <div className="rounded-2xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-warn-text">
            <p className="font-semibold">
              {bilangan(periksa.butuhKeputusan.length)} orang perlu dipilihkan
              atasannya lewat kartu anggota:
            </p>
            <ul className="mt-1 space-y-0.5">
              {periksa.butuhKeputusan.map((b) => (
                <li key={b.id}>
                  {b.nama} ({b.role}) — {b.sebab}
                </li>
              ))}
            </ul>
          </div>
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
            disabled={menyimpan || periksa.ubah.length === 0}
            onClick={terapkan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            {menyimpan
              ? "Menyimpan…"
              : `Terapkan ${bilangan(periksa.ubah.length)} perubahan`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
