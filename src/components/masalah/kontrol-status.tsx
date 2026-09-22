"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ARTI_STATUS_MASALAH,
  GAYA_STATUS_MASALAH,
  LABEL_STATUS_MASALAH,
  type Masalah,
  type StatusMasalah,
} from "@/lib/masalah";
import { ubahStatusMasalah } from "@/app/actions/masalah";

/**
 * Langkah status yang masuk akal dari keadaan sekarang.
 *
 * Yang ditawarkan sengaja sedikit: papan berguna justru karena
 * statusnya berarti, dan status berarti hanya kalau tidak bisa dilompati
 * semaunya. "Selesai" tidak ada di sini — ia menyertai penulisan
 * solusinya di kartu Solusi, sebab menandai selesai tanpa jawaban
 * adalah persis yang ditolak database (0121).
 */
const LANJUTAN_STATUS: Record<StatusMasalah, StatusMasalah[]> = {
  baru: ["diproses", "ditutup"],
  diproses: ["ditutup"],
  selesai: ["diproses"],
  ditutup: ["diproses"],
};

/** Kata kerja yang tepat untuk tiap perpindahan. */
const AJAKAN: Record<StatusMasalah, string> = {
  baru: "Kembalikan ke baru",
  diproses: "Terima & proses",
  selesai: "Tandai selesai",
  ditutup: "Tutup laporan",
};

export function KontrolStatus({ masalah }: { masalah: Masalah }) {
  const [tujuan, setTujuan] = useState<StatusMasalah | null>(null);
  const [alasan, setAlasan] = useState(masalah.ditutupAlasan);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  const pilihan = LANJUTAN_STATUS[masalah.status];
  const perluAlasan = tujuan === "ditutup";
  const siap = !perluAlasan || alasan.trim().length >= 10;

  const simpan = () => {
    if (!tujuan || !siap || menyimpan) return;
    mulai(async () => {
      setPesan(null);
      const hasil = await ubahStatusMasalah({
        masalahId: masalah.id,
        status: tujuan,
        alasan,
      });
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
      setTujuan(null);
    });
  };

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Status laporan</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Sekarang{" "}
          <span className="font-semibold">
            {LABEL_STATUS_MASALAH[masalah.status].toLowerCase()}
          </span>{" "}
          — {ARTI_STATUS_MASALAH[masalah.status].toLowerCase()}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 px-5">
        {pilihan.map((ke) => {
          const gaya = GAYA_STATUS_MASALAH[ke];
          return (
            <button
              key={ke}
              type="button"
              onClick={() => {
                setPesan(null);
                setTujuan(ke);
              }}
              className={cn(
                "tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] leading-[14px] font-semibold",
                gaya.kelas,
              )}
            >
              {ke === "ditutup" ? (
                <X className="size-3.5" />
              ) : (
                <Check className="size-3.5" />
              )}
              {AJAKAN[ke]}
            </button>
          );
        })}
      </div>

      {masalah.status === "ditutup" && masalah.ditutupAlasan ? (
        <p className="mx-5 rounded-2xl bg-muted px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
          Alasan penutupan: {masalah.ditutupAlasan}
        </p>
      ) : null}

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

      <Dialog
        open={tujuan !== null}
        onOpenChange={(b) => {
          if (!b) setTujuan(null);
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tujuan ? AJAKAN[tujuan] : ""}?</DialogTitle>
            <DialogDescription>
              {tujuan === "ditutup"
                ? "Laporan ditutup tanpa solusi. Alasannya akan menjadi satu-satunya jejak mengapa tidak dikerjakan."
                : tujuan
                  ? ARTI_STATUS_MASALAH[tujuan]
                  : ""}
            </DialogDescription>
          </DialogHeader>

          {perluAlasan ? (
            <div className="space-y-1.5">
              <label
                htmlFor="alasan-tutup"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Alasan penutupan
              </label>
              <textarea
                id="alasan-tutup"
                value={alasan}
                maxLength={300}
                rows={3}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Mis. perangkatnya sudah diganti, keluhannya tidak berulang"
                className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
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
              disabled={!siap || menyimpan}
              onClick={simpan}
              className="tekan-halus rounded-full"
            >
              {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
