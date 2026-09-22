"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, FlaskConical, Loader2, Play } from "lucide-react";
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
import { jalankanMigrasi } from "@/app/actions/migrasi";

/**
 * Menjalankan uji coba atau migrasi sungguhan.
 *
 * Uji coba tidak dikonfirmasi apa-apa — ia tidak menulis sebaris pun,
 * jadi menghalanginya hanya membuat orang enggan memakainya. Yang
 * sungguhan dikonfirmasi, karena menulis ribuan baris ke seluruh tabel
 * dan tidak ada tombol untuk membatalkannya.
 */
export function PanelJalankan({
  siapSungguhan,
  alasanBelumSiap,
}: {
  siapSungguhan: boolean;
  alasanBelumSiap: string;
}) {
  const [buka, setBuka] = useState(false);
  const [berjalan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  const jalankan = (tahap: "uji_coba" | "sungguhan") =>
    mulai(async () => {
      setPesan(null);
      const hasil = await jalankanMigrasi(tahap);
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
      setBuka(false);
    });

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Jalankan</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Uji coba membaca seluruh data lama dan melaporkan apa yang akan
          terjadi, tanpa menulis apa pun. Jalankan itu dulu, sesering
          diperlukan.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 px-5">
        <Button
          type="button"
          variant="outline"
          disabled={berjalan}
          onClick={() => jalankan("uji_coba")}
          className="tekan-halus sentuh-nyaman h-10 rounded-full px-4 text-[11px] font-semibold"
        >
          {berjalan ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FlaskConical className="size-3.5" />
          )}
          Jalankan uji coba
        </Button>

        <Button
          type="button"
          disabled={berjalan || !siapSungguhan}
          onClick={() => setBuka(true)}
          className="tekan-halus sentuh-nyaman h-10 rounded-full px-4 text-[11px] font-semibold"
        >
          <Play className="size-3.5" />
          Migrasi sungguhan
        </Button>
      </div>

      {!siapSungguhan ? (
        <p className="mx-5 rounded-2xl bg-muted px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
          {alasanBelumSiap}
        </p>
      ) : null}

      {pesan ? (
        <p
          role="status"
          className={
            berhasil
              ? "mx-5 rounded-2xl bg-ok-fill px-4 py-2.5 text-[13px] leading-[18px] text-pretty text-ok-text"
              : "mx-5 rounded-2xl bg-warn-fill px-4 py-2.5 text-[13px] leading-[18px] text-pretty text-warn-text"
          }
        >
          {pesan}
        </p>
      ) : null}

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Jalankan migrasi sungguhan?</DialogTitle>
            <DialogDescription>
              Data lama akan ditulis ke seluruh tabel tujuan sesuai pemetaan
              yang sudah disetujui. Tidak ada tombol untuk membatalkannya —
              pastikan uji coba terakhir sudah bersih dari kegagalan.
            </DialogDescription>
          </DialogHeader>

          <p className="flex items-start gap-2 rounded-2xl bg-warn-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-warn-text">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Sebaiknya dijalankan di luar jam kerja, saat tidak ada yang sedang
            mengisi laporan harian.
          </p>

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
              disabled={berjalan}
              onClick={() => jalankan("sungguhan")}
              className="tekan-halus rounded-full"
            >
              {berjalan ? <Loader2 className="size-4 animate-spin" /> : null}
              Jalankan sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
