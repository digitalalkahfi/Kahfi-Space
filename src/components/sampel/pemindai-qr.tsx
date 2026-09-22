"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Camera, CameraOff, Loader2, ScanLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { cariSampel } from "@/app/actions/sampel";
import type { Sampel } from "@/lib/sampel";

/** Bentuk `BarcodeDetector` yang dipakai; belum ada di lib DOM bawaan. */
type PembacaKode = {
  detect: (sumber: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

type KonstruktorPembaca = new (opsi: { formats: string[] }) => PembacaKode;

function ambilPembaca(): KonstruktorPembaca | null {
  const w = window as unknown as { BarcodeDetector?: KonstruktorPembaca };
  return w.BarcodeDetector ?? null;
}

/**
 * Pemindai kode sampel.
 *
 * Kamera adalah jalur tercepat, tapi tidak pernah satu-satunya: banyak
 * peramban belum punya `BarcodeDetector`, izin kamera bisa ditolak, dan
 * di gudang kadang lebih cepat mengetik kode yang sudah terbaca mata.
 * Karena itu pengetikan manual selalu tersedia, bukan sekadar cadangan
 * yang muncul setelah kamera gagal.
 */
export function PemindaiQr({
  onKetemu,
}: {
  onKetemu: (sampel: Sampel) => void;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const aliran = useRef<MediaStream | null>(null);
  const berjalan = useRef(false);

  const [kameraHidup, setKameraHidup] = useState(false);
  const [kode, setKode] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);
  const [mencari, mulai] = useTransition();

  const cari = useCallback(
    (nilai: string) => {
      if (!nilai.trim()) return;
      mulai(async () => {
        setPesan(null);
        const hasil = await cariSampel(nilai);
        if (hasil.ok && hasil.data) {
          onKetemu(hasil.data);
          setKode("");
          return;
        }
        setPesan(hasil.pesan ?? "Sampel tidak ditemukan.");
      });
    },
    [onKetemu],
  );

  const matikanKamera = useCallback(() => {
    berjalan.current = false;
    aliran.current?.getTracks().forEach((t) => t.stop());
    aliran.current = null;
    if (video.current) video.current.srcObject = null;
    setKameraHidup(false);
  }, []);

  // Kamera harus berhenti saat komponennya hilang; lampu kamera yang
  // menyala setelah pengguna pindah halaman adalah kesalahan yang nyata.
  useEffect(() => matikanKamera, [matikanKamera]);

  const nyalakanKamera = async () => {
    setPesan(null);
    const Pembaca = ambilPembaca();

    if (!Pembaca) {
      setPesan(
        "Peramban ini belum bisa membaca QR langsung. Ketik kodenya di bawah — hasilnya sama.",
      );
      return;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      aliran.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      setKameraHidup(true);
      berjalan.current = true;

      const pembaca = new Pembaca({ formats: ["qr_code", "code_128"] });

      const periksa = async () => {
        if (!berjalan.current || !video.current) return;
        try {
          const hasil = await pembaca.detect(video.current);
          const terbaca = hasil[0]?.rawValue?.trim();
          if (terbaca) {
            matikanKamera();
            cari(terbaca);
            return;
          }
        } catch {
          // Satu bingkai gagal dibaca bukan alasan berhenti memindai.
        }
        requestAnimationFrame(() => void periksa());
      };

      void periksa();
    } catch {
      setPesan(
        "Kamera tidak bisa dipakai — izinnya belum diberikan atau perangkatnya tidak punya kamera. Ketik kodenya di bawah.",
      );
      matikanKamera();
    }
  };

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <ScanLine className="size-4 text-muted-foreground" />
          Pindai kode sampel
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Arahkan kamera ke stiker QR, atau ketik kodenya langsung.
        </p>
      </div>

      <div className="px-5">
        <div
          className={cn(
            "relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted",
            !kameraHidup && "flex items-center justify-center",
          )}
        >
          <video
            ref={video}
            playsInline
            muted
            className={cn(
              "size-full object-cover",
              kameraHidup ? "block" : "hidden",
            )}
          />

          {kameraHidup ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-8 rounded-2xl ring-2 ring-primary-foreground/70"
            />
          ) : (
            <span className="flex flex-col items-center gap-2 text-muted-foreground">
              <Camera className="size-8" />
              <span className="text-[11px] leading-[14px]">
                Kamera belum menyala
              </span>
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {kameraHidup ? (
            <Button
              type="button"
              variant="outline"
              onClick={matikanKamera}
              className="tekan-halus sentuh-nyaman h-10 rounded-full px-4 text-[11px] font-semibold"
            >
              <CameraOff className="size-3.5" />
              Matikan kamera
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void nyalakanKamera()}
              className="tekan-halus sentuh-nyaman h-10 rounded-full px-4 text-[11px] font-semibold"
            >
              <Camera className="size-3.5" />
              Nyalakan kamera
            </Button>
          )}
        </div>
      </div>

      <form
        className="flex gap-2 px-5"
        onSubmit={(e) => {
          e.preventDefault();
          cari(kode);
        }}
      >
        <input
          value={kode}
          maxLength={60}
          autoComplete="off"
          spellCheck={false}
          aria-label="Kode sampel"
          onChange={(e) => setKode(e.target.value.toUpperCase())}
          placeholder="SMP-0001"
          className="tabular h-12 min-w-0 flex-1 rounded-xl bg-muted px-4 font-mono text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <Button
          type="submit"
          disabled={mencari || kode.trim() === ""}
          className="tekan-halus sentuh-nyaman h-12 shrink-0 rounded-full px-5 text-[11px] font-semibold"
        >
          {mencari ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Cari
        </Button>
      </form>

      {pesan ? (
        <p
          role="status"
          className="mx-5 rounded-2xl bg-warn-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-warn-text"
        >
          {pesan}
        </p>
      ) : null}
    </Card>
  );
}
