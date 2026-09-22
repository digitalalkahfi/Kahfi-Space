"use client";

import { useState, useTransition } from "react";
import { Loader2, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { kunciKpiBulan } from "@/app/actions/kpi";
import type { StatusKunciKpi } from "@/lib/data/kpi";

/**
 * Penguncian KPI bulanan.
 *
 * Penguncian tidak bisa dibatalkan, jadi tombolnya hanya hidup saat
 * bulannya benar-benar sudah selesai, dan konfirmasinya menyebut
 * akibatnya lebih dulu — bukan sekadar "yakin?".
 */
export function PanelKunciKpi({
  status,
  bulan,
  bulanLabel,
}: {
  status: StatusKunciKpi;
  bulan: string;
  bulanLabel: string;
}) {
  const [buka, setBuka] = useState(false);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  const sudahSemua = status.belum === 0 && status.terkunci > 0;

  const kunci = () => {
    if (menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await kunciKpiBulan(bulan);
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
      setBuka(false);
    });
  };

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
            {sudahSemua ? (
              <Lock className="size-4 text-muted-foreground" />
            ) : (
              <LockOpen className="size-4 text-muted-foreground" />
            )}
            Snapshot {bulanLabel}
          </h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {sudahSemua
              ? `${status.terkunci} skor sudah dikunci${
                  status.dikunciOleh ? ` oleh ${status.dikunciOleh}` : ""
                } dan tidak bisa diubah lagi.`
              : status.terkunci > 0
                ? `${status.terkunci} skor terkunci, ${status.belum} belum. Mengunci lagi hanya menambah yang tersisa.`
                : `${status.belum} skor masih dihitung ulang setiap kali halaman dibuka.`}
          </p>
        </div>

        {!sudahSemua ? (
          <Button
            type="button"
            disabled={!status.bulanTuntas || menyimpan}
            onClick={() => setBuka(true)}
            className="tekan-halus sentuh-nyaman h-9 shrink-0 rounded-full px-4 text-[11px] font-semibold"
          >
            {menyimpan ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Kunci {bulanLabel}
          </Button>
        ) : null}
      </div>

      {!status.bulanTuntas && !sudahSemua ? (
        <p className="mx-5 rounded-2xl bg-muted px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
          {bulanLabel} belum selesai. KPI baru bisa dikunci setelah bulannya
          berakhir, supaya skor separuh bulan tidak terlanjur jadi angka resmi.
        </p>
      ) : null}

      {pesan ? (
        <p
          role="status"
          className={
            berhasil
              ? "mx-5 rounded-2xl bg-ok-fill px-4 py-2.5 text-[11px] leading-[14px] text-ok-text"
              : "mx-5 rounded-2xl bg-warn-fill px-4 py-2.5 text-[11px] leading-[14px] text-warn-text"
          }
        >
          {pesan}
        </p>
      ) : null}

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kunci KPI {bulanLabel}?</DialogTitle>
            <DialogDescription>
              Skor {status.belum} orang dibekukan apa adanya saat ini, lengkap
              dengan cakupan datanya. Setelah terkunci, angkanya tidak bisa
              diubah, dihitung ulang, maupun dihapus — termasuk oleh CEO.
            </DialogDescription>
          </DialogHeader>

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
              onClick={kunci}
              className="tekan-halus rounded-full"
            >
              {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
              Kunci permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
