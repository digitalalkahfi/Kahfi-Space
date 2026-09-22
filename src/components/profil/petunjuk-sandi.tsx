"use client";

import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LABEL_KEKUATAN,
  SYARAT_SANDI,
  kekuatanSandi,
  periksaSandi,
  type Kekuatan,
} from "@/lib/keamanan";

const GAYA_KEKUATAN: Record<
  Kekuatan,
  { bar: string; teks: string; isi: number }
> = {
  lemah: { bar: "bg-danger", teks: "text-danger-text", isi: 33 },
  sedang: { bar: "bg-warn", teks: "text-warn-text", isi: 66 },
  kuat: { bar: "bg-ok", teks: "text-ok-text", isi: 100 },
};

/**
 * Petunjuk sandi yang hidup: syarat tercentang saat terpenuhi.
 *
 * Syaratnya dibaca dari daftar yang sama yang dipakai memvalidasi
 * (lib/keamanan.ts), jadi yang tercentang di layar tidak bisa berbeda
 * dari yang benar-benar diterima saat menyimpan.
 *
 * Ditulis sekali dan dipakai dua tempat — kartu pemeriksa di halaman
 * Keamanan dan form ganti sandi — supaya keduanya tidak pernah
 * menyebutkan aturan yang berbeda.
 */
export function PetunjukSandi({
  sandi,
  konteks,
  className,
}: {
  sandi: string;
  /** Nama dan email pemilik akun; sandi tidak boleh memuat keduanya. */
  konteks?: { nama?: string; email?: string };
  className?: string;
}) {
  const hasil = periksaSandi(sandi, konteks ?? {});
  const adaIsi = sandi.length > 0;
  // Sandi yang ditolak tidak pernah disebut "Cukup" atau "Kuat": bilah
  // hijau di sebelah kalimat penolakan membuat orang mengira ia sudah
  // boleh memakainya.
  const kekuatan: Kekuatan = hasil.ok ? kekuatanSandi(sandi) : "lemah";
  const gaya = GAYA_KEKUATAN[kekuatan];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Kekuatan
          </span>
          <span
            className={cn(
              "text-[11px] leading-[14px] font-semibold",
              adaIsi ? gaya.teks : "text-muted-foreground",
            )}
          >
            {adaIsi ? LABEL_KEKUATAN[kekuatan] : "Belum diisi"}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Kekuatan kata sandi"
          aria-valuenow={adaIsi ? gaya.isi : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={adaIsi ? LABEL_KEKUATAN[kekuatan] : "Belum diisi"}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              adaIsi ? gaya.bar : "bg-transparent",
            )}
            style={{ width: `${adaIsi ? gaya.isi : 0}%` }}
          />
        </div>
      </div>

      <ul className="space-y-1">
        {SYARAT_SANDI.map((s) => {
          const lolos = adaIsi && s.penuhi(sandi);
          return (
            <li
              key={s.kunci}
              className={cn(
                "flex items-center gap-2 text-[13px] leading-[18px]",
                lolos ? "text-ok-text" : "text-muted-foreground",
              )}
            >
              {lolos ? (
                <Check className="size-3.5 shrink-0" />
              ) : (
                <Circle className="size-3.5 shrink-0" />
              )}
              {s.label}
            </li>
          );
        })}
      </ul>

      {/* Alasan di luar daftar syarat — sandi umum, atau memuat nama
          sendiri — hanya muncul setelah bentuknya benar, supaya tidak
          menumpuk dengan centang yang masih kosong. */}
      {adaIsi && hasil.pesan ? (
        <p className="text-[11px] leading-[14px] text-pretty text-warn-text">
          {hasil.pesan}
        </p>
      ) : null}
    </div>
  );
}
