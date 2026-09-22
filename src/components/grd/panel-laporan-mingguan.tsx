"use client";

import { useState, useTransition } from "react";
import { FileClock, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { tanggalPendek } from "@/lib/format";
import { buatLaporanMingguan } from "@/app/actions/mingguan";

/**
 * Pembentukan laporan mingguan.
 *
 * Pekan berjalan sengaja tidak bisa dibentuk: separuh pekan selalu terbaca
 * merah tanpa sebab. Yang tampil di tabel untuk pekan berjalan adalah
 * hitungan langsung, bukan arsip.
 */
export function PanelLaporanMingguan({
  pekan,
  sudahAda,
}: {
  /** Selalu pekan yang sudah berakhir — pekan berjalan tidak dibentuk. */
  pekan: string;
  sudahAda: boolean;
}) {
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  const bentuk = () => {
    if (menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await buatLaporanMingguan(pekan);
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
    });
  };

  const akhir = new Date(`${pekan}T00:00:00Z`);
  akhir.setUTCDate(akhir.getUTCDate() + 6);
  const label = `${tanggalPendek(pekan)} – ${tanggalPendek(akhir.toISOString().slice(0, 10))}`;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
            <FileClock className="size-4 text-muted-foreground" />
            Laporan pekan {label}
          </h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {sudahAda
              ? "Laporan pekan ini sudah tersimpan. Membentuk ulang memperbarui angkanya bila laporan harian sempat dikoreksi."
              : "Dibentuk dari laporan harian dan papan lead measure pekan itu — tidak diketik manual."}
          </p>
        </div>

        <Button
          type="button"
          disabled={menyimpan}
          onClick={bentuk}
          className="tekan-halus sentuh-nyaman h-9 shrink-0 rounded-full px-4 text-[11px] font-semibold"
        >
          {menyimpan ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {sudahAda ? "Bentuk ulang" : "Bentuk laporan"}
        </Button>
      </div>

      <p className="mx-5 rounded-2xl bg-muted px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
        Pekan berjalan tidak ikut dibentuk: separuh pekan selalu terbaca merah
        tanpa sebab. Barisnya di tabel dihitung langsung dari data harian.
      </p>

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
    </Card>
  );
}
