"use client";

import { useState } from "react";
import { ChevronDown, Lock, Trophy } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen } from "@/lib/format";
import {
  LABEL_SUMBER,
  predikatDariSkor,
  ringkasScorecard,
  type BarisScorecard,
} from "@/lib/kpi";
import {
  LencanaPredikat,
  TandaPredikat,
} from "@/components/grd/lencana-predikat";

const ANGKA = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Satu baris scorecard, bisa dibuka untuk melihat rincian indikatornya. */
function BarisOrang({ baris }: { baris: BarisScorecard }) {
  const [buka, setBuka] = useState(false);

  return (
    <li className="rounded-2xl bg-muted/50">
      <button
        type="button"
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        className="baris-interaktif flex w-full items-center gap-3 rounded-2xl p-3.5 text-left"
      >
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="bg-card text-[11px] font-semibold text-muted-foreground">
            {baris.inisial}
          </AvatarFallback>
        </Avatar>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-5 font-semibold">
            {baris.nama}
          </span>
          <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
            {baris.jabatan}
          </span>
        </span>

        {baris.cakupan < 100 ? (
          <span className="shrink-0 rounded-full bg-warn-fill px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-warn-text">
            data {persen(baris.cakupan, 0)}
          </span>
        ) : null}

        <span className="shrink-0 text-right">
          <span className="tabular block text-base leading-6 font-bold tracking-tight">
            {ANGKA.format(baris.skor)}
          </span>
          <TandaPredikat predikat={baris.predikat} />
        </span>

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            buka && "rotate-180",
          )}
        />
      </button>

      {buka ? (
        <ul className="space-y-1.5 px-3.5 pb-3.5">
          {baris.rincian.map((r) => (
            <li
              key={r.nama}
              className="flex items-center gap-3 rounded-xl bg-card px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-[18px] font-medium">
                  {r.nama}
                </span>
                <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                  {LABEL_SUMBER[r.sumber]} · bobot {persen(r.bobot, 0)}
                </span>
              </span>
              <span className="tabular shrink-0 text-right">
                <span
                  className={cn(
                    "block text-[13px] leading-[18px] font-semibold",
                    !r.berlaku && "text-muted-foreground",
                  )}
                >
                  {r.berlaku && r.skor !== null ? ANGKA.format(r.skor) : "—"}
                </span>
                <span className="block text-[11px] leading-[14px] text-muted-foreground">
                  {r.berlaku && r.realisasi !== null
                    ? `${persen(r.realisasi)} ${r.satuan === "%" ? "" : r.satuan}`
                    : "tidak berlaku"}
                </span>
              </span>
            </li>
          ))}
          {baris.rincian.length === 0 ? (
            <li className="text-[11px] leading-[14px] text-muted-foreground">
              Belum ada indikator KPI untuk jabatan ini.
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}

/** Scorecard KPI tim: skor, predikat, dan rinciannya per orang. */
export function Scorecard({
  daftar,
  bulanLabel,
}: {
  daftar: BarisScorecard[];
  bulanLabel: string;
}) {
  const ringkas = ringkasScorecard(daftar);
  const rata = ringkas.rataRata;
  const terkunci = daftar.some((b) => b.terkunci);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
            <Trophy className="size-4 text-muted-foreground" />
            Scorecard KPI tim
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {bulanLabel} · skala 1.000
            {terkunci ? " · bulan terkunci" : ""}
          </p>
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Rata-rata dari {ringkas.dinilai} orang yang terukur penuh
            {ringkas.parsial > 0
              ? ` · ${ringkas.parsial} orang datanya belum lengkap`
              : ""}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="tabular block text-2xl leading-[30px] font-bold tracking-tight">
            {ANGKA.format(rata)}
          </span>
          <LencanaPredikat predikat={predikatDariSkor(rata)} ukuran="kecil" />
        </span>
      </div>

      {terkunci ? (
        <p className="mx-5 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-[11px] leading-[14px] text-muted-foreground">
          <Lock className="size-3 shrink-0" />
          Skor bulan ini sudah dikunci Manager dan tidak berubah lagi.
        </p>
      ) : null}

      {daftar.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada skor untuk periode ini.
        </p>
      ) : (
        <ul className="space-y-2 px-5">
          {daftar.map((b) => (
            <BarisOrang key={b.userId} baris={b} />
          ))}
        </ul>
      )}
    </Card>
  );
}
