"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileText, Loader2, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarCapaian } from "@/components/motion/bar-capaian";
import { cn } from "@/lib/utils";
import { persen, tanggalPendek } from "@/lib/format";
import { catatLeadMeasure } from "@/app/actions/lead-measure";
import type { LeadDetail } from "@/lib/data/grd";

const ANGKA = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/** Sebutan kolom laporan yang bisa dibaca orang di papan. */
const SEBUTAN_SUMBER: Record<string, string> = {
  gmv: "nilai GMV",
  komisi: "komisi",
  jumlah_upload: "jumlah upload",
};

/**
 * Papan skor satu lead measure: capaian pekan berjalan, entri harian yang
 * sudah masuk, dan formulir untuk mencatat hari ini.
 */
export function EntriLeadMeasure({
  lead,
  tanggal,
  bolehIsi,
}: {
  lead: LeadDetail;
  tanggal: string;
  bolehIsi: boolean;
}) {
  const hariIni = lead.entri.find((e) => e.tanggal === tanggal);
  const [nilai, setNilai] = useState(String(hariIni?.nilai ?? ""));
  const [pendukung, setPendukung] = useState(
    hariIni?.nilaiPendukung !== null && hariIni?.nilaiPendukung !== undefined
      ? String(hariIni.nilaiPendukung)
      : "",
  );
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const angka = Number(nilai.replace(",", "."));
  const siap = nilai !== "" && Number.isFinite(angka) && angka >= 0;
  const kuat = lead.rasio >= 90;

  const simpan = () => {
    if (!siap || menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await catatLeadMeasure({
        leadId: lead.id,
        tanggal,
        nilai: angka,
        nilaiPendukung: pendukung === "" ? null : Number(pendukung),
      });
      setPesan(hasil.pesan ?? null);
    });
  };

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="text-base leading-6 font-semibold">{lead.judul}</h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {lead.goalJudul}
          </p>
        </div>
        <span
          className={cn(
            "tabular shrink-0 rounded-full px-3 py-1 text-[13px] leading-[18px] font-bold",
            kuat ? "bg-ok-fill text-ok-text" : "bg-warn-fill text-warn-text",
          )}
        >
          {persen(lead.rasio)}
        </span>
      </div>

      <div className="space-y-1.5 px-5">
        <BarCapaian
          rasio={lead.rasio}
          label={`Capaian ${lead.judul}`}
          warna={kuat ? "bg-ok" : "bg-warn"}
        />
        <p className="tabular text-[11px] leading-[14px] text-muted-foreground">
          {ANGKA.format(lead.realisasi)} dari {ANGKA.format(lead.target)}{" "}
          {lead.satuan} pekan ini
          {lead.labelPendukung && lead.pendukung !== null
            ? ` · ${lead.labelPendukung}: ${ANGKA.format(lead.pendukung)}`
            : ""}
        </p>
      </div>

      {lead.entri.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 px-5">
          {lead.entri.map((e) => (
            <li
              key={e.tanggal}
              className={cn(
                "tabular rounded-xl px-2.5 py-1.5 text-[11px] leading-[14px]",
                e.tanggal === tanggal
                  ? "bg-info-fill text-info-text"
                  : "bg-muted text-muted-foreground",
              )}
              title={`${e.oleh}${e.catatan ? ` · ${e.catatan}` : ""}`}
            >
              <span className="font-semibold">{ANGKA.format(e.nilai)}</span>{" "}
              {tanggalPendek(e.tanggal).replace(/ \d{4}$/, "")}
            </li>
          ))}
        </ul>
      ) : null}

      {lead.sumberLaporan ? (
        /* Angkanya milik laporan harian (migrasi 0130). Menawarkan kotak
           isian di sini hanya menghasilkan penolakan dari trigger, dan
           membuat orang mengira ada dua tempat mengisi angka yang sama. */
        <div className="border-t border-border-subtle px-5 pt-3">
          <p className="flex items-start gap-2 rounded-xl bg-info-fill px-3 py-2 text-[11px] leading-[14px] text-info-text">
            <FileText className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Terisi otomatis dari {SEBUTAN_SUMBER[lead.sumberLaporan]} pada
              laporan harian. Perbaiki lewat{" "}
              <Link href="/laporan-harian" className="font-semibold underline">
                Laporan Harian
              </Link>
              , bukan di sini.
            </span>
          </p>
        </div>
      ) : bolehIsi ? (
        <form
          className="space-y-2 border-t border-border-subtle px-5 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            simpan();
          }}
        >
          <p className="text-[11px] leading-[14px] font-semibold">
            Realisasi hari ini
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Nilai {lead.satuan}</span>
              <input
                inputMode="decimal"
                value={nilai}
                onChange={(ev) => setNilai(ev.target.value)}
                placeholder={lead.satuan}
                className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </label>

            {lead.labelPendukung ? (
              <label className="min-w-0 flex-1">
                <span className="sr-only">{lead.labelPendukung}</span>
                <input
                  inputMode="decimal"
                  value={pendukung}
                  onChange={(ev) => setPendukung(ev.target.value)}
                  placeholder={lead.labelPendukung}
                  className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </label>
            ) : null}

            <Button
              type="submit"
              disabled={!siap || menyimpan}
              className="tekan-halus h-11 shrink-0 rounded-xl px-4 text-[13px] font-semibold"
            >
              {menyimpan ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Simpan
            </Button>
          </div>

          {pesan ? (
            <p
              role="status"
              className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text"
            >
              {pesan}
            </p>
          ) : null}
        </form>
      ) : null}
    </Card>
  );
}
