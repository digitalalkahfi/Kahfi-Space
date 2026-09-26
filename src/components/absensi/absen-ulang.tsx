"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { jamWib } from "@/lib/format";
import { absenUlang } from "@/app/actions/absensi";
import type { AbsensiHariIni } from "@/lib/data/absensi";

/** Sama dengan batas di fungsi database `absen_ulang` (migrasi 0171). */
export const MAKS_ABSEN_ULANG = 3;

/**
 * Tawaran mengulang absen hari ini.
 *
 * GPS ponsel kadang meleset dan orang yang berdiri di kantor tercatat
 * di luar radius. Mengulang berarti catatan lama dihapus dan ia absen
 * lagi sekarang — jamnya ikut jam sekarang, jadi peringatannya ditulis
 * sebelum tombolnya ditekan, bukan sesudah.
 */
export function AbsenUlang({
  absen,
  tahap,
  jamAturan,
  onSelesai,
}: {
  absen: AbsensiHariIni;
  tahap: "masuk" | "pulang";
  /** Jam masuk sesuai pengaturan, mis. "08:00". */
  jamAturan: string;
  /** Dipanggil setelah catatan lama terhapus, sebelum halaman dimuat ulang. */
  onSelesai?: () => void;
}) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [sibuk, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const dipakai = tahap === "masuk" ? absen.ulangMasuk : absen.ulangPulang;
  const sisa = Math.max(0, MAKS_ABSEN_ULANG - dipakai);
  const jamLama = tahap === "masuk" ? absen.jamMasuk : absen.jamPulang;
  const luarRadius = tahap === "masuk" && !absen.lokasiValid;

  const jalankan = () => {
    if (sibuk) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await absenUlang(tahap);
      if (!hasil.ok) {
        setPesan(hasil.pesan ?? "Gagal menghapus catatan absen.");
        return;
      }
      setBuka(false);
      onSelesai?.();
      router.refresh();
    });
  };

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3",
          luarRadius ? "bg-warn-fill" : "bg-muted",
        )}
      >
        <p
          className={cn(
            "min-w-0 flex-1 text-[11px] leading-[14px] text-pretty",
            luarRadius ? "text-warn-text" : "text-muted-foreground",
          )}
        >
          {luarRadius
            ? `Lokasi masuk tercatat di luar radius${
                absen.jarakMeter !== null
                  ? ` (${Math.round(absen.jarakMeter)} m)`
                  : ""
              }. Kalau GPS ponselmu meleset, ulangi absennya.`
            : `Salah lokasi saat absen ${tahap}? Catatannya bisa diulang.`}{" "}
          {sisa > 0
            ? `Sisa ${sisa} kali hari ini.`
            : "Batas absen ulang hari ini sudah habis."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sisa <= 0}
          onClick={() => setBuka(true)}
          className="tekan-halus h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold"
        >
          <RotateCcw className="size-3" />
          Absen {tahap} ulang
        </Button>
      </div>

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ulangi absen {tahap}?</DialogTitle>
            <DialogDescription>
              Catatan absen {tahap} pukul {jamLama ? jamWib(jamLama) : "—"} akan
              dihapus, lalu kamu absen {tahap} lagi sekarang dengan lokasi yang
              baru.
            </DialogDescription>
          </DialogHeader>

          {tahap === "masuk" ? (
            <p className="rounded-2xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-warn-text">
              Jam masuk yang berlaku adalah jam saat kamu absen lagi, bukan jam
              yang lama. Batas masuk {jamAturan} WIB ditambah toleransi — kalau
              sekarang sudah lewat, kamu tercatat terlambat.
            </p>
          ) : null}

          <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
            Absen ulang tercatat di rekap dan terlihat atasan. Maksimal{" "}
            {MAKS_ABSEN_ULANG} kali per hari.
          </p>

          {pesan ? (
            <p
              role="status"
              className="rounded-xl bg-danger-fill px-3 py-2 text-[11px] leading-[14px] text-danger-text"
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
              disabled={sibuk}
              onClick={jalankan}
              className="tekan-halus rounded-full"
            >
              {sibuk ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              {sibuk ? "Menghapus…" : "Ya, hapus dan absen ulang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
