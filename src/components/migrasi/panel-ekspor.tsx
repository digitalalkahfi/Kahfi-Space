"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Download, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MasalahKv, RingkasKv } from "@/lib/kv-store";

/**
 * Panel ekspor kv_store.
 *
 * Yang ditonjolkan bukan jumlah entri, melainkan yang bermasalah — itulah
 * yang menentukan berapa lama migrasi sungguhan akan makan waktu. Entri
 * rapi tidak butuh perhatian siapa pun.
 */
export function PanelEkspor({
  sumber,
  dibuatPada,
  jumlah,
  ringkas,
  masalah,
  contohJson,
  tiruan,
}: {
  sumber: string;
  dibuatPada: string;
  jumlah: number;
  ringkas: RingkasKv[];
  masalah: MasalahKv[];
  contohJson: string;
  /** Benar bila `kv_store_lama` masih kosong dan yang dipakai berkas contoh. */
  tiruan: boolean;
}) {
  const [bukaContoh, setBukaContoh] = useState(false);
  const takDikenali = ringkas.filter((r) => !r.dikenali);

  const unduh = () => {
    const berkas = new Blob([contohJson], { type: "application/json" });
    const url = URL.createObjectURL(berkas);
    const tautan = document.createElement("a");
    tautan.href = url;
    tautan.download = "kv-store-contoh.json";
    tautan.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
            <FileJson className="size-4 text-muted-foreground" />
            Ekspor {sumber}
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {jumlah} entri · diambil {dibuatPada}
          </p>
          {tiruan ? (
            <p className="mt-1 inline-flex rounded-full bg-warn-fill px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-warn-text">
              Berkas contoh — tabel kv_store_lama masih kosong
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={unduh}
          className="tekan-halus sentuh-nyaman h-9 shrink-0 rounded-full px-4 text-[11px] font-semibold"
        >
          <Download className="size-3.5" />
          Unduh JSON
        </Button>
      </div>

      <div className="px-5">
        <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          Isi per entitas
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {ringkas.map((r) => (
            <li
              key={r.entitas}
              className={cn(
                "tabular rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
                r.dikenali
                  ? "bg-muted text-muted-foreground"
                  : "bg-warn-fill text-warn-text",
              )}
            >
              {r.entitas} {r.jumlah}
            </li>
          ))}
        </ul>
        {takDikenali.length > 0 ? (
          <p className="mt-1.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
            {takDikenali.map((r) => r.entitas).join(", ")} tidak punya tempat di
            skema baru — akan dilewati, bukan gagal.
          </p>
        ) : null}
      </div>

      {masalah.length > 0 ? (
        <div className="px-5">
          <p className="flex items-start gap-2 rounded-2xl bg-warn-fill px-4 py-2.5 text-[13px] leading-[18px] text-warn-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span className="text-pretty">
              {masalah.length} entri sudah bermasalah dari bentuk kuncinya.
              Kejanggalan isi — tanggal bergaya lain, angka bertanda pemisah,
              rujukan yang sudah hilang — baru ketahuan saat uji coba.
            </span>
          </p>

          <ul className="mt-2 space-y-1">
            {masalah.slice(0, 12).map((m) => (
              <li
                key={`${m.key}-${m.sebab}`}
                className="rounded-xl bg-muted/50 px-3 py-2"
              >
                <p className="font-mono text-[11px] leading-[14px] break-all">
                  {m.key}
                </p>
                <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  {m.sebab}
                </p>
              </li>
            ))}
          </ul>

          {masalah.length > 12 ? (
            <p className="mt-1.5 text-[11px] leading-[14px] text-muted-foreground">
              dan {masalah.length - 12} lainnya.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="px-5">
        <button
          type="button"
          onClick={() => setBukaContoh((b) => !b)}
          aria-expanded={bukaContoh}
          className="baris-interaktif flex w-full items-center justify-between gap-2 rounded-xl px-1 py-2 text-left text-[13px] leading-[18px] font-semibold"
        >
          Lihat cuplikan mentahnya
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              bukaContoh && "rotate-180",
            )}
          />
        </button>

        {bukaContoh ? (
          <pre className="max-h-72 overflow-auto rounded-2xl bg-muted p-3 font-mono text-[11px] leading-[16px]">
            {contohJson}
          </pre>
        ) : null}
      </div>
    </Card>
  );
}
