"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Stethoscope, UserRoundCheck, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalPendek } from "@/lib/format";
import { putuskanIzin } from "@/app/actions/absensi";
import type { PengajuanIzin } from "@/lib/data/absensi";

/** Antrean persetujuan izin/sakit untuk atasan. */
export function DaftarPengajuan({ pengajuan }: { pengajuan: PengajuanIzin[] }) {
  const [, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const [daftar, putusOptimis] = useOptimistic(
    pengajuan,
    (kini: PengajuanIzin[], id: string) => kini.filter((p) => p.id !== id),
  );

  const putuskan = (id: string, keputusan: "disetujui" | "ditolak") => {
    mulai(async () => {
      putusOptimis(id);
      const hasil = await putuskanIzin(id, keputusan);
      setPesan(hasil.pesan ?? null);
    });
  };

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Pengajuan menunggu keputusan
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {daftar.length === 0
              ? "Tidak ada pengajuan yang tertunda."
              : `${daftar.length} pengajuan dari tim yang kamu bawahi.`}
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <UserRoundCheck className="size-4" />
        </span>
      </div>

      {daftar.length > 0 ? (
        <ul className="space-y-2 px-5">
          {daftar.map((p) => (
            <li
              key={p.id}
              className="baris-interaktif rounded-2xl bg-muted/60 p-3.5"
            >
              <div className="flex items-start gap-3">
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="bg-card text-[11px] font-semibold text-muted-foreground">
                    {p.inisial}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm leading-5 font-semibold">{p.nama}</p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-[13px] font-semibold",
                        p.jenis === "sakit"
                          ? "bg-info-fill text-info-text"
                          : "bg-accentmuted-fill text-accentmuted-text",
                      )}
                    >
                      <Stethoscope className="size-2.5" />
                      {p.jenis === "sakit" ? "Sakit" : "Izin"}
                    </span>
                  </div>
                  <p className="tabular text-[11px] leading-[14px] text-muted-foreground">
                    {tanggalPendek(p.tanggal)} · {p.unit}
                  </p>
                  <p className="mt-1 text-[13px] leading-[18px] text-pretty">
                    {p.alasan}
                  </p>

                  <div className="mt-2.5 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => putuskan(p.id, "disetujui")}
                      className="tekan-halus sentuh-nyaman h-8 rounded-full px-3 text-[11px] font-semibold"
                    >
                      <Check className="size-3" />
                      Setujui
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => putuskan(p.id, "ditolak")}
                      className="tekan-halus sentuh-nyaman h-8 rounded-full px-3 text-[11px] font-semibold"
                    >
                      <X className="size-3" />
                      Tolak
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {pesan ? (
        <p
          role="status"
          className="px-5 text-[11px] leading-[14px] text-muted-foreground"
        >
          {pesan}
        </p>
      ) : null}
    </Card>
  );
}
