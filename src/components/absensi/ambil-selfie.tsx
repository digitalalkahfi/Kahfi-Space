"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ImageUp, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fotoMasihBaru, ukuranKecil } from "@/lib/foto-selfie";

export type HasilSelfie = { blob: Blob; pratinjau: string };

/** Kecilkan gambar ke JPEG ≤ 720 px; null bila peramban gagal. */
async function keJpeg(
  sumber: CanvasImageSource,
  lebarAsli: number,
  tinggiAsli: number,
): Promise<Blob | null> {
  const { lebar, tinggi } = ukuranKecil(lebarAsli, tinggiAsli);
  if (!lebar || !tinggi) return null;
  const kanvas = document.createElement("canvas");
  kanvas.width = lebar;
  kanvas.height = tinggi;
  const ctx = kanvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(sumber, 0, 0, lebar, tinggi);
  return new Promise<Blob | null>((selesai) =>
    kanvas.toBlob(selesai, "image/jpeg", 0.82),
  );
}

/**
 * Pratinjau kamera depan untuk selfie absensi.
 *
 * Kamera baru dinyalakan saat tombol ditekan — bukan saat halaman dibuka —
 * supaya izin tidak diminta tanpa sebab dan baterai tidak terkuras.
 *
 * Jalur cadangan: sebagian peramban bawaan HP (mis. HeyTap di Realme/Oppo)
 * dan peramban di dalam aplikasi menolak kamera untuk halaman web. Bila
 * kamera gagal dibuka, tombol "Ambil foto dengan kamera HP" membuka
 * aplikasi kamera bawaan lewat `<input capture>`, yang didukung hampir
 * semua peramban. Fotonya dikecilkan dengan cara yang sama.
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
  /** Kamera di halaman gagal: tampilkan jalur kamera HP. */
  const [pakaiCadangan, setPakaiCadangan] = useState(false);
  const berkasRef = useRef<HTMLInputElement>(null);

  const matikan = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setNyala(false);
  }, []);

  useEffect(() => matikan, [matikan]);

  // Elemen <video> baru dipasang setelah `nyala` benar, jadi aliran kamera
  // dihubungkan di sini — bukan langsung setelah getUserMedia, saat
  // elemennya belum ada. Tanpa ini kamera menyala tapi layar tetap gelap.
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!nyala || !video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => {
      setGalat(
        "Pratinjau kamera tidak bisa diputar. Coba tekan Nyalakan kamera lagi.",
      );
    });
  }, [nyala]);

  const nyalakan = async () => {
    setGalat(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setNyala(true);
    } catch {
      setPakaiCadangan(true);
      setGalat(
        "Kamera tidak bisa dibuka di peramban ini. Pakai tombol Ambil foto dengan kamera HP di bawah, atau izinkan akses kamera lalu coba lagi.",
      );
    }
  };

  const dariKameraHp = async (berkas: File | undefined) => {
    if (!berkas) return;
    if (!berkas.type.startsWith("image/")) {
      setGalat("Berkas itu bukan foto. Ambil foto dengan kamera HP.");
      return;
    }
    if (!fotoMasihBaru(berkas.lastModified, Date.now())) {
      setGalat(
        "Foto itu diambil lebih dari 10 menit lalu. Ambil selfie baru dengan kamera, bukan dari galeri.",
      );
      return;
    }
    const url = URL.createObjectURL(berkas);
    try {
      const gambar = new Image();
      gambar.src = url;
      await gambar.decode();
      const blob = await keJpeg(
        gambar,
        gambar.naturalWidth,
        gambar.naturalHeight,
      );
      if (!blob) {
        setGalat("Foto tidak bisa diproses. Coba ambil ulang.");
        return;
      }
      setGalat(null);
      onAmbil({ blob, pratinjau: URL.createObjectURL(blob) });
    } catch {
      setGalat("Foto tidak bisa dibaca. Coba ambil ulang.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const jepret = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.videoWidth || !video.videoHeight) {
      setGalat("Gambar kamera belum siap. Tunggu sebentar, lalu jepret lagi.");
      return;
    }
    setGalat(null);

    // Turunkan resolusi: bukti kehadiran, bukti wajah — tidak perlu besar.
    const blob = await keJpeg(video, video.videoWidth, video.videoHeight);
    if (!blob) return;

    matikan();
    onAmbil({ blob, pratinjau: URL.createObjectURL(blob) });
  };

  const ulangi = () => {
    if (hasil) URL.revokeObjectURL(hasil.pratinjau);
    onAmbil(null);
    // Yang tadi memakai kamera HP langsung membukanya lagi.
    if (pakaiCadangan) berkasRef.current?.click();
    else void nyalakan();
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

      {pakaiCadangan && !hasil ? (
        <Button
          type="button"
          onClick={() => berkasRef.current?.click()}
          disabled={nonaktif}
          className="tekan-halus h-10 w-full rounded-full text-[13px] font-semibold"
        >
          <ImageUp className="size-4" />
          Ambil foto dengan kamera HP
        </Button>
      ) : null}

      <input
        ref={berkasRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          void dariKameraHp(e.target.files?.[0]);
          // Supaya memilih foto yang sama sekali lagi tetap memicu onChange.
          e.target.value = "";
        }}
      />
    </div>
  );
}
