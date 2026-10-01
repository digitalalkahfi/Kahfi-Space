"use client";

import { useState } from "react";
import { ChevronDown, Lock, Trophy } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen } from "@/lib/format";
import {
  KOLOM_TANGGA,
  LABEL_SUMBER,
  predikatDariSkor,
  ringkasScorecard,
  tampilAngkaKpi,
  type BarisScorecard,
  type RincianGrd,
  type RincianKpi,
} from "@/lib/kpi";
import {
  LencanaPredikat,
  TandaPredikat,
} from "@/components/grd/lencana-predikat";
import { DialogIsiPencapaian } from "@/components/grd/dialog-isi-pencapaian";

const ANGKA = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Rincian indikator rumus jabatan: skor 0–1.000 dari realisasinya. */
function RincianJabatan({ r }: { r: RincianKpi }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-card px-3 py-2">
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
  );
}

/**
 * Posisi pencapaian di tangga 10 kolom. Kolom 4 (BASE) dan 8 (GOAL)
 * diberi sela supaya tiga wilayahnya — di bawah base, menuju goal,
 * stretch — terbaca sekilas, sama seperti tanda di file GRD.
 */
function TanggaMini({ nilai }: { nilai: number }) {
  return (
    <span
      role="img"
      aria-label={`VALUE ${nilai} dari ${KOLOM_TANGGA}`}
      className="flex items-center gap-0.5"
    >
      {Array.from({ length: KOLOM_TANGGA }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-2.5 rounded-full",
            i < nilai ? "bg-primary" : "bg-muted",
            (i === 4 || i === 8) && "ml-1",
          )}
        />
      ))}
    </span>
  );
}

/** Rincian indikator lembar GRD: pencapaian, VALUE, dan totalnya. */
function RincianLembar({ r }: { r: RincianGrd }) {
  return (
    <li className="space-y-1.5 rounded-xl bg-card px-3 py-2">
      <span className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-[18px] font-medium">
            {r.nama}
          </span>
          <span className="block text-[11px] leading-[14px] text-muted-foreground">
            bobot {r.bobot} · goal {tampilAngkaKpi(r.tangga[7], r.satuan)}
            {r.arah === "turun" ? " · makin kecil makin baik" : ""}
          </span>
        </span>
        <span className="tabular shrink-0 text-right">
          <span className="block text-[13px] leading-[18px] font-semibold">
            {ANGKA.format(r.total)}
          </span>
          <span className="block text-[11px] leading-[14px] text-muted-foreground">
            {r.pencapaian === null
              ? "belum diisi"
              : tampilAngkaKpi(r.pencapaian, r.satuan)}
          </span>
        </span>
      </span>
      <span className="flex items-center justify-between gap-3">
        <TanggaMini nilai={r.nilai} />
        <span className="tabular text-[11px] leading-[14px] text-muted-foreground">
          VALUE {r.nilai}
        </span>
      </span>
    </li>
  );
}

/** Keterangan kecil di samping nama: kelengkapan data orang ini. */
function TandaKelengkapan({ baris }: { baris: BarisScorecard }) {
  let teks: string | null = null;
  if (baris.metode === "grd") {
    if (baris.rincian.length === 0) teks = "belum ada lembar";
    else if (baris.predikat !== null && baris.cakupan < 100)
      teks = `terisi ${persen(baris.cakupan, 0)}`;
  } else if (baris.cakupan < 100) {
    teks = `data ${persen(baris.cakupan, 0)}`;
  }
  if (!teks) return null;

  return (
    <span className="shrink-0 rounded-full bg-warn-fill px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-warn-text">
      {teks}
    </span>
  );
}

/** Satu baris scorecard, bisa dibuka untuk melihat rincian indikatornya. */
function BarisOrang({
  baris,
  bulan,
  bulanLabel,
}: {
  baris: BarisScorecard;
  bulan: string;
  bulanLabel: string;
}) {
  const [buka, setBuka] = useState(false);
  const belumAdaLembar = baris.metode === "grd" && baris.rincian.length === 0;

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

        <TandaKelengkapan baris={baris} />

        <span className="shrink-0 text-right">
          <span
            className={cn(
              "tabular block text-base leading-6 font-bold tracking-tight",
              belumAdaLembar && "text-muted-foreground",
            )}
          >
            {belumAdaLembar ? "—" : ANGKA.format(baris.skor)}
          </span>
          {belumAdaLembar ? null : <TandaPredikat predikat={baris.predikat} />}
        </span>

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            buka && "rotate-180",
          )}
        />
      </button>

      {buka ? (
        <div className="space-y-2 px-3.5 pb-3.5">
          <ul className="space-y-1.5">
            {baris.metode === "grd"
              ? baris.rincian.map((r) => (
                  <RincianLembar key={r.indikatorId} r={r} />
                ))
              : baris.rincian.map((r) => <RincianJabatan key={r.nama} r={r} />)}
          </ul>
          {baris.rincian.length === 0 ? (
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              {baris.metode === "grd"
                ? "Belum ada lembar KPI aktif untuk orang ini pada bulan ini."
                : "Belum ada indikator KPI untuk jabatan ini."}
            </p>
          ) : null}
          {baris.metode === "grd" && baris.bolehMenilai ? (
            <div className="flex justify-end">
              <DialogIsiPencapaian
                userId={baris.userId}
                nama={baris.nama}
                bulan={bulan}
                bulanLabel={bulanLabel}
                rincian={baris.rincian}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Scorecard KPI tim: skor, predikat, dan rinciannya per orang. */
export function Scorecard({
  daftar,
  bulan,
  bulanLabel,
}: {
  daftar: BarisScorecard[];
  bulan: string;
  bulanLabel: string;
}) {
  const ringkas = ringkasScorecard(daftar);
  const rata = ringkas.rataRata;
  const terkunci = daftar.some((b) => b.terkunci);
  const grd = daftar.some((b) => b.metode === "grd");

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
            {grd ? " · tangga GRD 10 kolom" : ""}
            {terkunci ? " · bulan terkunci" : ""}
          </p>
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Rata-rata dari {ringkas.dinilai} orang yang{" "}
            {grd ? "sudah dinilai" : "terukur penuh"}
            {ringkas.parsial > 0
              ? grd
                ? ` · ${ringkas.parsial} orang belum dinilai`
                : ` · ${ringkas.parsial} orang datanya belum lengkap`
              : ""}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="tabular block text-2xl leading-[30px] font-bold tracking-tight">
            {ringkas.dinilai > 0 ? ANGKA.format(rata) : "—"}
          </span>
          {/* Belum ada yang dinilai: bukan "Perlu Perbaikan", tetapi belum diisi. */}
          <LencanaPredikat
            predikat={ringkas.dinilai > 0 ? predikatDariSkor(rata) : null}
            ukuran="kecil"
          />
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
            <BarisOrang
              key={b.userId}
              baris={b}
              bulan={bulan}
              bulanLabel={bulanLabel}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
