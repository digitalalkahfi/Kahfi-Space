"use client";

import { useState, useTransition } from "react";
import { Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ubahStatusMasukan } from "@/app/actions/masukan";
import { LABEL_STATUS_MASUKAN, type Masukan } from "@/lib/masukan";

/**
 * Panel bagi penanggung jawab laporan.
 *
 * Ia yang mengerjakan, jadi ia pula yang menandai kemajuannya — tanpa
 * harus meminta pengelola, yang membuat status di layar selalu
 * tertinggal dari kenyataan. Penugasan dan penolakan tetap keputusan
 * pengelola (0093).
 */
export function PanelPenanggung({ masukan }: { masukan: Masukan }) {
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  const gerakkan = (status: "dikerjakan" | "selesai") =>
    mulai(async () => {
      setPesan(null);
      const hasil = await ubahStatusMasukan({
        masukanId: masukan.id,
        status,
      });
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
    });

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <Wrench className="size-4 text-muted-foreground" />
          Laporan ini ditugaskan kepadamu
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Tandai kemajuannya sendiri; pelapor langsung melihat perubahannya.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 px-5">
        {(["dikerjakan", "selesai"] as const).map((s) => (
          <Button
            key={s}
            type="button"
            variant={masukan.status === s ? "default" : "outline"}
            disabled={menyimpan || masukan.status === s}
            onClick={() => gerakkan(s)}
            className={cn(
              "tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold",
            )}
          >
            {menyimpan ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Tandai {LABEL_STATUS_MASUKAN[s].toLowerCase()}
          </Button>
        ))}
      </div>

      {pesan ? (
        <p
          role="status"
          className={
            berhasil
              ? "mx-5 rounded-2xl bg-ok-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-ok-text"
              : "mx-5 rounded-2xl bg-warn-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-warn-text"
          }
        >
          {pesan}
        </p>
      ) : null}
    </Card>
  );
}
