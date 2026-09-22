"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HasilSelfie = { blob: Blob; pratinjau: string };

/**
 * Pratinjau kamera depan untuk selfie absensi.
 *
 * Kamera baru dinyalakan saat tombol ditekan — bukan saat halaman dibuka —
 * supaya izin tidak diminta tanpa sebab dan baterai tidak terkuras.
 */
export function AmbilSelfie({
  onAmbil,
  hasil,
  nonaktif,
  stempel,
}: {
  onAmbil: (hasil: HasilSelfie | null) => void;
  hasil: HasilSelfie | null;
  nonaktif?: boolean;
  /** Stempel koordinat pada pratinjau (DESIGN.md §Components 6). */
  stempel?: { teks: string; valid: boolean | null };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [nyala, setNyala] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const matikan = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setNyala(false);
  }, []);

  useEffect(() => matikan, [matikan]);

  const nyalakan = async () => {
    setGalat(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setNyala(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setGalat(
        "Kamera tidak bisa dibuka. Izinkan akses kamera di peramban, lalu coba lagi.",
      );
    }
  };

  const jepret = async () => {
    const video = videoRef.current;
    if (!video) return;

    const kanvas = document.createElement("canvas");
    // Turunkan resolusi: bukti kehadiran, bukti wajah — tidak perlu besar.
    const lebar = Math.min(video.videoWidth || 640, 720);
    const skala = lebar / (video.videoWidth || lebar);
    kanvas.width = lebar;
    kanvas.height = (video.videoHeight || 480) * skala;

    const ctx = kanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, kanvas.width, kanvas.height);

    const blob = await new Promise<Blob | null>((selesai) =>
      kanvas.toBlob(selesai, "image/jpeg", 0.82),
    );
    if (!blob) return;

    matikan();
    onAmbil({ blob, pratinjau: URL.createObjectURL(blob) });
  };

  const ulangi = () => {
    if (hasil) URL.revokeObjectURL(hasil.pratinjau);
    onAmbil(null);
    void nyalakan();
  };

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-primary/90",
          !nyala && !hasil && "grid place-items-center",
        )}
      >
        {hasil ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hasil.pratinjau}
            alt="Pratinjau selfie absensi"
            className="size-full object-cover"
          />
        ) : nyala ? (
          <video
            ref={videoRef}
            playsInline
            muted
            className="size-full -scale-x-100 object-cover"
          />
        ) : (
          <div className="px-6 text-center">
            <CameraOff className="mx-auto size-6 text-primary-foreground/60" />
            <p className="mt-2 text-[13px] leading-[18px] text-primary-foreground/70">
              Kamera belum menyala
            </p>
          </div>
        )}

        {stempel ? (
          <span
            className={cn(
              "absolute bottom-3 left-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5",
              "rounded-full bg-primary/80 px-3 py-1.5 backdrop-blur",
              "text-[11px] leading-[14px] font-medium text-primary-foreground",
            )}
          >
            <MapPin
              className={cn(
                "size-3 shrink-0",
                stempel.valid === false && "text-danger",
                stempel.valid === true && "text-ok",
              )}
            />
            <span className="truncate">{stempel.teks}</span>
          </span>
        ) : null}
      </div>

      {galat ? (
        <p
          role="status"
          className="rounded-xl bg-danger-fill px-3 py-2 text-[11px] leading-[14px] text-danger-text"
        >
          {galat}
        </p>
      ) : null}

      <div className="flex gap-2">
        {hasil ? (
          <Button
            type="button"
            variant="outline"
            onClick={ulangi}
            disabled={nonaktif}
            className="tekan-halus h-10 flex-1 rounded-full text-[13px] font-semibold"
          >
            <RefreshCw className="size-4" />
            Ambil ulang
          </Button>
        ) : nyala ? (
          <Button
            type="button"
            onClick={jepret}
            disabled={nonaktif}
            className="tekan-halus h-10 flex-1 rounded-full text-[13px] font-semibold"
          >
            <Camera className="size-4" />
            Jepret selfie
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={nyalakan}
            disabled={nonaktif}
            className="tekan-halus h-10 flex-1 rounded-full text-[13px] font-semibold"
          >
            <Camera className="size-4" />
            Nyalakan kamera
          </Button>
        )}
      </div>
    </div>
  );
}
