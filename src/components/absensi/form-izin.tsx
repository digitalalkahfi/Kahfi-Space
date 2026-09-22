"use client";

import { useState, useTransition } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  Send,
  Stethoscope,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tanggalPanjang } from "@/lib/format";
import { ajukanIzin } from "@/app/actions/absensi";

const MIN_ALASAN = 5;
const MAKS_ALASAN = 300;

type Jenis = "izin" | "sakit";

/**
 * Pengajuan izin / sakit. Keputusannya ada di atasan (PRD §3), jadi form ini
 * hanya mengirim pengajuan — statusnya "diajukan" sampai diputuskan.
 */
export function FormIzin({
  tanggalAwal,
  batasAwal,
}: {
  tanggalAwal: string;
  /** Tanggal paling awal yang boleh diajukan. */
  batasAwal: string;
}) {
  const [jenis, setJenis] = useState<Jenis>("izin");
  const [tanggal, setTanggal] = useState(tanggalAwal);
  const [alasan, setAlasan] = useState("");
  const [mengirim, mulai] = useTransition();
  const [hasil, setHasil] = useState<{ ok: boolean; teks: string } | null>(
    null,
  );

  const siap = alasan.trim().length >= MIN_ALASAN && Boolean(tanggal);

  const kirim = () => {
    if (!siap || mengirim) return;
    setHasil(null);
    mulai(async () => {
      const r = await ajukanIzin({ tanggal, jenis, alasan });
      setHasil({ ok: r.ok, teks: r.pesan ?? "Pengajuan terkirim." });
      if (r.ok) setAlasan("");
    });
  };

  if (hasil?.ok) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="space-y-2 px-5 py-2 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-fill text-ok-text">
            <CheckCircle2 className="size-6" />
          </span>
          <h2 className="text-base leading-6 font-semibold">
            Pengajuan terkirim
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {jenis === "izin" ? "Izin" : "Sakit"} untuk{" "}
            {tanggalPanjang(tanggal)} menunggu persetujuan atasan.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setHasil(null)}
            className="tekan-halus h-10 rounded-full px-5 text-[13px] font-semibold"
          >
            Ajukan lagi
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Ajukan izin atau sakit
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Atasan langsungmu yang memutuskan.
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info-fill text-info-text">
          <Stethoscope className="size-4" />
        </span>
      </div>

      <form
        className="space-y-4 px-5"
        onSubmit={(e) => {
          e.preventDefault();
          kirim();
        }}
      >
        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-[18px] font-semibold">
            Jenis pengajuan
          </legend>
          <div className="flex gap-2">
            {(
              [
                { nilai: "izin", label: "Izin" },
                { nilai: "sakit", label: "Sakit" },
              ] as const
            ).map((o) => (
              <button
                key={o.nilai}
                type="button"
                onClick={() => setJenis(o.nilai)}
                aria-pressed={jenis === o.nilai}
                className={cn(
                  "tekan-halus h-11 flex-1 rounded-xl text-[13px] font-semibold",
                  jenis === o.nilai
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label
            htmlFor="tanggal-izin"
            className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold"
          >
            <CalendarDays className="size-3.5 text-muted-foreground" />
            Tanggal
          </label>
          <input
            id="tanggal-izin"
            type="date"
            value={tanggal}
            min={batasAwal}
            onChange={(e) => setTanggal(e.target.value)}
            className="tabular h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="alasan-izin"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Alasan
          </label>
          <textarea
            id="alasan-izin"
            rows={3}
            maxLength={MAKS_ALASAN}
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder={
              jenis === "sakit"
                ? "Mis. demam sejak semalam, istirahat sesuai anjuran klinik."
                : "Mis. mengurus dokumen keluarga di luar kota."
            }
            className="min-h-[88px] w-full resize-none rounded-xl bg-muted px-4 py-3 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <div className="flex items-center justify-between gap-2 text-[11px] leading-[14px]">
            <span
              className={cn(
                siap ? "font-semibold text-ok-text" : "text-muted-foreground",
              )}
            >
              {siap
                ? "Siap diajukan"
                : `Tulis alasan minimal ${MIN_ALASAN} karakter`}
            </span>
            <span className="tabular text-muted-foreground">
              {alasan.length}/{MAKS_ALASAN}
            </span>
          </div>
        </div>

        {hasil && !hasil.ok ? (
          <p
            role="status"
            className="rounded-xl bg-warn-fill px-4 py-2.5 text-[13px] leading-[18px] text-warn-text"
          >
            {hasil.teks}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={!siap || mengirim}
          className="tekan-halus h-14 w-full rounded-full text-[13px] font-semibold"
        >
          {mengirim ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {mengirim ? "Mengirim…" : "Kirim pengajuan"}
        </Button>
      </form>
    </Card>
  );
}
