"use client";

import { useState, useTransition } from "react";
import { Banknote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { rupiahRingkas, tanggalPendek } from "@/lib/format";
import { putuskanPengeluaran } from "@/app/actions/keuangan";
import { LABEL_JENIS_KELUAR, type Transaksi } from "@/lib/keuangan";

/**
 * Pengeluaran yang sudah disetujui tetapi belum dibayar.
 *
 * Dipisahkan dari antrean persetujuan karena pertanyaannya berbeda:
 * yang satu "boleh atau tidak", yang ini "sudah keluar atau belum".
 * Selama belum ditandai dibayar, posisi kas belum bergerak sepeser pun —
 * dan justru di celah inilah kas sering terlihat lebih besar dari
 * kenyataannya.
 */
export function PanelPembayaran({
  daftar,
  bolehBayar,
}: {
  daftar: Transaksi[];
  bolehBayar: boolean;
}) {
  const [memproses, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  if (daftar.length === 0) return null;

  const total = daftar.reduce((n, t) => n + t.jumlah, 0);

  const bayar = (id: string) =>
    mulai(async () => {
      setPesan(null);
      const hasil = await putuskanPengeluaran({
        transaksiId: id,
        keputusan: "dibayar",
      });
      setPesan(hasil.pesan ?? null);
    });

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <Banknote className="size-4 text-muted-foreground" />
          Disetujui, menunggu pembayaran
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {rupiahRingkas(total)} sudah disetujui tetapi belum keluar dari kas.
        </p>
      </div>

      <ul className="space-y-2 px-5">
        {daftar.map((t) => (
          <li key={t.id} className="rounded-2xl bg-muted/50 p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-[18px] font-semibold text-pretty">
                  {t.keterangan}
                </span>
                <span className="block text-[11px] leading-[14px] text-muted-foreground">
                  {tanggalPendek(t.tanggal)} · {t.unitNama}
                  {t.jenis ? ` · ${LABEL_JENIS_KELUAR[t.jenis]}` : ""}
                  {t.disetujuiNama ? ` · disetujui ${t.disetujuiNama}` : ""}
                </span>
              </span>
              <span className="tabular shrink-0 text-[13px] leading-[18px] font-semibold">
                {rupiahRingkas(t.jumlah)}
              </span>
            </div>

            {bolehBayar ? (
              <Button
                type="button"
                variant="outline"
                disabled={memproses}
                onClick={() => bayar(t.id)}
                className="tekan-halus sentuh-nyaman mt-2 h-9 rounded-full px-4 text-[11px] font-semibold"
              >
                {memproses ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Banknote className="size-3.5" />
                )}
                Tandai sudah dibayar
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

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
