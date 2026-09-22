"use client";

import { useState, useTransition } from "react";
import { ArrowRight, History, PencilLine } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputGmv } from "@/components/laporan-harian/input-gmv";
import { cn } from "@/lib/utils";
import { jamWib, rupiahPenuh, tanggalPendek } from "@/lib/format";
import { perbaikiLaporan } from "@/app/actions/laporan";
import type { LaporanHarian, RevisiLaporan } from "@/lib/types";

const MIN_ALASAN = 10;

/**
 * Perbaikan laporan yang berjejak (PRD §3): angka lama, angka baru, dan
 * alasannya dicatat sebagai baris `daily_report_revisions` — laporan tidak
 * pernah diubah diam-diam.
 */
export function DialogRevisi({
  laporan,
  jejak,
  olehNama,
  onSimpan,
}: {
  laporan: LaporanHarian;
  jejak: RevisiLaporan[];
  olehNama: string;
  onSimpan: (revisi: RevisiLaporan) => void;
}) {
  const [buka, setBuka] = useState(false);
  const [gmvBaru, setGmvBaru] = useState(laporan.gmv);
  const [alasan, setAlasan] = useState("");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const berubah = gmvBaru !== laporan.gmv && gmvBaru > 0;
  const alasanCukup = alasan.trim().length >= MIN_ALASAN;
  const bisaSimpan = berubah && alasanCukup;
  const selisih = gmvBaru - laporan.gmv;

  const simpan = () => {
    if (!bisaSimpan || menyimpan) return;
    setPesan(null);

    mulai(async () => {
      const hasil = await perbaikiLaporan({
        reportId: laporan.id,
        gmv: gmvBaru,
        alasan: alasan.trim(),
      });

      // Di mode demo alurnya tetap diperlihatkan; datanya tidak tersimpan.
      if (!hasil.ok && hasil.kode !== "demo") {
        setPesan(hasil.pesan);
        return;
      }

      onSimpan({
        id: `rev-${Date.now()}`,
        reportId: laporan.id,
        gmvLama: laporan.gmv,
        gmvBaru,
        alasan: alasan.trim(),
        diubahOleh: olehNama,
        createdAt: new Date().toISOString(),
      });
      setAlasan("");
      setBuka(false);
    });
  };

  return (
    <Dialog
      open={buka}
      onOpenChange={(v) => {
        setBuka(v);
        if (v) {
          setGmvBaru(laporan.gmv);
          setAlasan("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="tekan-halus sentuh-nyaman h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold"
        >
          <PencilLine className="size-3" />
          Perbaiki
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Perbaiki laporan</DialogTitle>
          <DialogDescription>
            {laporan.label} · {tanggalPendek(laporan.tanggal)}. Perubahan angka
            GMV selalu meninggalkan jejak.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                Angka sekarang
              </p>
              <p className="tabular truncate text-sm leading-5 font-semibold">
                {rupiahPenuh(laporan.gmv)}
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                Angka baru
              </p>
              <p
                className={cn(
                  "tabular truncate text-sm leading-5 font-semibold",
                  berubah
                    ? selisih > 0
                      ? "text-ok-text"
                      : "text-danger-text"
                    : "text-muted-foreground",
                )}
              >
                {gmvBaru > 0 ? rupiahPenuh(gmvBaru) : "—"}
                {berubah ? (
                  <span className="ml-1 text-[11px] leading-[14px]">
                    ({selisih > 0 ? "+" : "−"}
                    {rupiahPenuh(Math.abs(selisih))})
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="gmv-revisi"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Nilai GMV yang benar
            </label>
            <InputGmv id="gmv-revisi" nilai={gmvBaru} onUbah={setGmvBaru} />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="alasan"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Alasan perbaikan
            </label>
            <textarea
              id="alasan"
              rows={3}
              maxLength={300}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Mis. ada pesanan masuk setelah cutoff yang belum terhitung."
              className="w-full resize-none rounded-xl bg-muted px-4 py-3 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <p
              className={cn(
                "text-[11px] leading-[14px]",
                alasan.length > 0 && !alasanCukup
                  ? "font-semibold text-warn-text"
                  : "text-muted-foreground",
              )}
            >
              {alasan.length > 0 && !alasanCukup
                ? `Tulis minimal ${MIN_ALASAN} karakter supaya jejaknya berguna.`
                : "Alasan wajib diisi dan ikut tercatat di jejak revisi."}
            </p>
          </div>

          {jejak.length > 0 ? (
            <div className="space-y-2 border-t border-border-subtle pt-3">
              <p className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold">
                <History className="size-3.5 text-muted-foreground" />
                Jejak revisi ({jejak.length})
              </p>
              <ul className="space-y-2">
                {jejak.map((r) => (
                  <li key={r.id} className="rounded-xl bg-muted/60 px-3 py-2.5">
                    <p className="tabular text-[11px] leading-[14px] font-semibold">
                      {rupiahPenuh(r.gmvLama)} → {rupiahPenuh(r.gmvBaru)}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-[14px] text-muted-foreground">
                      {r.alasan}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-[14px] text-muted-foreground">
                      {r.diubahOleh} · {tanggalPendek(r.createdAt)}{" "}
                      {jamWib(r.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {pesan ? (
          <p
            role="status"
            className="rounded-xl bg-danger-fill px-4 py-2.5 text-[13px] leading-[18px] text-danger-text"
          >
            {pesan}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="tekan-halus rounded-full"
            >
              Batal
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={!bisaSimpan || menyimpan}
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? "Menyimpan…" : "Simpan perbaikan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
