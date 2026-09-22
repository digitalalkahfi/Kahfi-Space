"use client";

import { useState, useTransition } from "react";
import { Banknote, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { putuskanPengeluaran } from "@/app/actions/keuangan";
import type { IzinPersetujuan, Transaksi } from "@/lib/keuangan";

/**
 * Keputusan atas satu pengajuan: setujui, tolak, atau tandai dibayar.
 *
 * Yang ditawarkan hanya langkah yang mungkin dari keadaan sekarang, dan
 * alasan penolakan wajib diisi sebelum tombolnya hidup — pengajuan yang
 * ditolak tanpa keterangan hanya akan diajukan ulang apa adanya.
 */
export function AksiKeputusan({
  transaksi,
  izin,
  bolehBayar,
}: {
  transaksi: Transaksi;
  izin: IzinPersetujuan;
  bolehBayar: boolean;
}) {
  const [memproses, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [menolak, setMenolak] = useState(false);
  const [alasan, setAlasan] = useState("");

  const menunggu = transaksi.status === "diajukan";
  const siapDibayar = transaksi.status === "disetujui";

  if (!menunggu && !siapDibayar) return null;

  const putuskan = (keputusan: "disetujui" | "ditolak" | "dibayar") =>
    mulai(async () => {
      setPesan(null);
      const hasil = await putuskanPengeluaran({
        transaksiId: transaksi.id,
        keputusan,
        catatan: keputusan === "ditolak" ? alasan : undefined,
      });
      setPesan(hasil.pesan ?? null);
      if (hasil.ok) {
        setMenolak(false);
        setAlasan("");
      }
    });

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          {menunggu ? "Putuskan pengajuan ini" : "Tandai pembayaran"}
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {menunggu
            ? izin.bolehPutuskan
              ? "Pengeluaran belum mengurangi kas sampai disetujui dan dibayar."
              : izin.alasan
            : "Kas baru bergerak setelah pengeluaran ini ditandai dibayar."}
        </p>
      </div>

      {menunggu && izin.bolehPutuskan ? (
        <div className="space-y-2 px-5">
          {menolak ? (
            <textarea
              value={alasan}
              rows={2}
              maxLength={200}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Alasan penolakan — apa yang perlu diperbaiki?"
              className="w-full rounded-xl bg-muted px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={memproses}
              onClick={() => putuskan("disetujui")}
              className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
            >
              {memproses ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Setujui
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={memproses || (menolak && alasan.trim().length < 10)}
              onClick={() => (menolak ? putuskan("ditolak") : setMenolak(true))}
              className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
            >
              <X className="size-3.5" />
              {menolak ? "Kirim penolakan" : "Tolak"}
            </Button>
          </div>
        </div>
      ) : null}

      {siapDibayar && bolehBayar ? (
        <div className="px-5">
          <Button
            type="button"
            variant="outline"
            disabled={memproses}
            onClick={() => putuskan("dibayar")}
            className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
          >
            {memproses ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Banknote className="size-3.5" />
            )}
            Tandai sudah dibayar
          </Button>
        </div>
      ) : null}

      {pesan ? (
        <p
          role="status"
          className="mx-5 rounded-2xl bg-muted px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-muted-foreground"
        >
          {pesan}
        </p>
      ) : null}
    </Card>
  );
}
