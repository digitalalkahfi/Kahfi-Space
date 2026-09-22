import Link from "next/link";
import { ArrowRight, Lock, LockOpen, MapPin } from "lucide-react";
import { MunculPop } from "@/components/motion/muncul-pop";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * Pengingat aturan inti: tombol Absen Pulang terkunci sampai laporan
 * harian hari itu terkirim (PRD §2).
 */
export function StatusAbsen({
  jamMasuk,
  lokasi,
  terkunci,
}: {
  jamMasuk: string;
  lokasi: string;
  /** Terkunci selama laporan harian hari ini belum terkirim. */
  terkunci: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 items-stretch gap-3">
        <Card className="kartu-interaktif h-full rounded-2xl bg-ok-fill ring-0">
          <div className="px-4">
            <p className="text-[11px] leading-[14px] font-semibold tracking-[0.04em] text-ok-text uppercase">
              Absen Masuk
            </p>
            <p className="tabular mt-1 flex items-baseline gap-1 text-2xl leading-[30px] font-bold tracking-tight text-ok-text">
              {jamMasuk}
              <span className="text-[11px] leading-[14px] font-medium">
                WIB
              </span>
            </p>
            <p className="mt-1.5 flex items-center gap-1 text-[11px] leading-[14px] text-ok-text/80">
              <MapPin className="size-3 shrink-0" />
              {lokasi}
            </p>
          </div>
        </Card>

        <MunculPop kunci={terkunci}>
          <Card
            className={cn(
              "kartu-interaktif h-full rounded-2xl ring-0",
              terkunci ? "bg-muted" : "bg-info-fill",
            )}
          >
            <div className="px-4">
              <div className="flex items-start justify-between gap-2">
                <p
                  className={cn(
                    "text-[11px] leading-[14px] font-semibold tracking-[0.04em] uppercase",
                    terkunci ? "text-muted-foreground" : "text-info-text",
                  )}
                >
                  Absen Pulang
                </p>
                {terkunci ? (
                  <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <LockOpen className="size-3.5 shrink-0 text-info-text" />
                )}
              </div>
              <p
                className={cn(
                  "tabular mt-1 flex items-baseline gap-1 text-2xl leading-[30px] font-bold tracking-tight",
                  terkunci ? "text-muted-foreground" : "text-info-text",
                )}
              >
                --:--
                <span className="text-[11px] leading-[14px] font-medium">
                  WIB
                </span>
              </p>
              {terkunci ? (
                <p className="mt-1.5 text-[11px] leading-[14px] font-semibold text-danger-text">
                  Terkunci: wajib lapor GMV
                </p>
              ) : (
                <Button
                  asChild
                  size="sm"
                  className="tekan-halus mt-2 h-8 w-full rounded-full text-[11px] font-semibold"
                >
                  <Link href="/absensi">
                    Absen pulang sekarang
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              )}
            </div>
          </Card>
        </MunculPop>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-start gap-2.5 rounded-2xl px-4 py-3",
          terkunci ? "bg-warn-fill" : "bg-ok-fill",
        )}
      >
        {terkunci ? (
          <Lock className="mt-0.5 size-4 shrink-0 text-warn-text" />
        ) : (
          <LockOpen className="mt-0.5 size-4 shrink-0 text-ok-text" />
        )}
        <p
          className={cn(
            "text-[13px] leading-[18px]",
            terkunci ? "text-warn-text" : "text-ok-text",
          )}
        >
          {terkunci
            ? "Absen pulang terbuka otomatis begitu laporan GMV harian terkirim."
            : "Laporan hari ini sudah masuk — Absen Pulang kini terbuka. Selesaikan sebelum meninggalkan lokasi."}
        </p>
      </div>
    </div>
  );
}
