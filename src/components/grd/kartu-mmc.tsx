import { CalendarCheck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen, tanggalPendek } from "@/lib/format";
import type { LeadDetail } from "@/lib/data/grd";

const ANGKA = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/**
 * MMC sebagai lead measure MCN (PRD §3).
 *
 * MMC bukan unit pelaporan tersendiri: ia acara pendukung MCN. Yang diukur
 * adalah kreator yang berhasil di-bind per tanggal acara, dengan jumlah
 * peserta hadir sebagai angka pendukung — dari keduanya lahir tingkat
 * konversi acara, angka yang paling menjelaskan apakah MMC berhasil.
 */
export function KartuMmc({ lead }: { lead: LeadDetail }) {
  const acara = lead.entri.filter(
    (e) => e.nilaiPendukung !== null && e.nilaiPendukung > 0,
  );

  const totalPeserta = acara.reduce((a, e) => a + (e.nilaiPendukung ?? 0), 0);
  const totalBind = acara.reduce((a, e) => a + e.nilai, 0);
  const konversi = totalPeserta > 0 ? (totalBind / totalPeserta) * 100 : 0;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            MMC · kreator bind
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Lead measure unit MCN, dicatat per tanggal acara
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info-fill text-info-text">
          <Users className="size-4" />
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 px-5">
        {[
          { label: "Peserta hadir", nilai: ANGKA.format(totalPeserta) },
          { label: "Kreator bind", nilai: ANGKA.format(totalBind) },
          { label: "Konversi", nilai: persen(konversi) },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl bg-muted/60 p-3">
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              {k.label}
            </p>
            <p className="tabular mt-0.5 text-base leading-6 font-bold tracking-tight">
              {k.nilai}
            </p>
          </div>
        ))}
      </div>

      {acara.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada acara MMC tercatat pekan ini.
        </p>
      ) : (
        <ul className="space-y-2 px-5">
          {acara.map((e) => {
            const peserta = e.nilaiPendukung ?? 0;
            const rasio = peserta > 0 ? (e.nilai / peserta) * 100 : 0;
            const kuat = rasio >= 15;
            return (
              <li
                key={e.tanggal}
                className="baris-interaktif flex items-center gap-3 rounded-2xl bg-muted/50 p-3.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground">
                  <CalendarCheck className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-[18px] font-semibold">
                    {tanggalPendek(e.tanggal)}
                  </p>
                  <p className="tabular text-[11px] leading-[14px] text-muted-foreground">
                    {ANGKA.format(peserta)} peserta · {ANGKA.format(e.nilai)}{" "}
                    kreator di-bind
                    {e.oleh ? ` · ${e.oleh}` : ""}
                  </p>
                </div>

                <span
                  className={cn(
                    "tabular shrink-0 text-[13px] leading-[18px] font-bold",
                    kuat ? "text-ok-text" : "text-warn-text",
                  )}
                >
                  {persen(rasio)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="border-t border-border-subtle px-5 pt-3 text-[11px] leading-[14px] text-pretty text-muted-foreground">
        MMC tidak melapor GMV sendiri — hasilnya masuk lewat unit MCN.
      </p>
    </Card>
  );
}
