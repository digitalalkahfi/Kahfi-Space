"use client";

import Link from "next/link";
import { ArrowRight, Package, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas } from "@/lib/format";
import {
  GAYA_STATUS_SAMPEL,
  LABEL_STATUS_SAMPEL,
  type Sampel,
} from "@/lib/sampel";

/** Sampel yang baru saja terpindai, beserta keadaannya sekarang. */
export function KartuHasilPindai({ sampel }: { sampel: Sampel }) {
  const gaya = GAYA_STATUS_SAMPEL[sampel.status];

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start gap-3 px-5">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl",
            sampel.status === "hilang"
              ? "bg-danger-fill text-danger-text"
              : "bg-muted text-muted-foreground",
          )}
        >
          {sampel.status === "hilang" ? (
            <TriangleAlert className="size-5" />
          ) : (
            <Package className="size-5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-base leading-6 font-semibold text-pretty">
            {sampel.nama}
          </p>
          <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
            {sampel.kode}
          </p>
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            {sampel.kategori} · {sampel.unitNama} ·{" "}
            {rupiahRingkas(sampel.nilai)}
          </p>
        </div>

        <span
          className={cn(
            "inline-flex h-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
            gaya.kelas,
          )}
        >
          <span className={cn("size-1.5 rounded-full", gaya.titik)} />
          {LABEL_STATUS_SAMPEL[sampel.status]}
        </span>
      </div>

      <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
        {sampel.pemegangNama
          ? `Sekarang dipegang ${sampel.pemegangNama}.`
          : sampel.kreator
            ? `Sekarang ada di kreator ${sampel.kreator}.`
            : "Sekarang ada di gudang."}
        {sampel.catatan ? ` ${sampel.catatan}` : ""}
      </p>

      <div className="px-5">
        <Link
          href={`/sampel/${encodeURIComponent(sampel.kode)}`}
          className="baris-interaktif flex items-center gap-2 rounded-2xl bg-muted/50 px-4 py-3 text-[13px] leading-[18px] font-semibold"
        >
          <span className="flex-1">Lihat riwayat &amp; catat perpindahan</span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>
    </Card>
  );
}
