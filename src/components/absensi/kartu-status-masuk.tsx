import {
  CheckCircle2,
  Clock,
  LogIn,
  MapPin,
  MapPinOff,
  Stethoscope,
  TimerOff,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { jamWib } from "@/lib/format";
import type { AbsensiHariIni } from "@/lib/data/absensi";

/** Kalimat status yang langsung menjawab "aku tadi gimana?". */
function ringkasan(absen: AbsensiHariIni, jamAturan: string) {
  if (absen.status === "izin" || absen.status === "sakit") {
    const label = absen.status === "izin" ? "Izin" : "Sakit";
    const lanjut =
      absen.persetujuan === "disetujui"
        ? "disetujui atasan"
        : absen.persetujuan === "ditolak"
          ? "ditolak atasan"
          : "menunggu persetujuan";
    return { judul: `${label} — ${lanjut}`, nada: "info" as const };
  }

  if (!absen.jamMasuk) {
    return {
      judul: `Belum absen masuk · jadwal ${jamAturan} WIB`,
      nada: "netral" as const,
    };
  }

  if (absen.terlambat) {
    const menit = absen.selisihMenit ?? 0;
    return {
      judul:
        menit > 0
          ? `Terlambat ${menit} menit dari batas toleransi`
          : "Tercatat terlambat",
      nada: "peringatan" as const,
    };
  }

  const lebihAwal = absen.selisihMenit !== null ? -absen.selisihMenit : null;
  return {
    judul:
      lebihAwal !== null && lebihAwal > 0
        ? `Tepat waktu — ${lebihAwal} menit sebelum batas`
        : "Tepat waktu",
    nada: "baik" as const,
  };
}

const NADA = {
  baik: { kartu: "bg-ok-fill", teks: "text-ok-text", Ikon: CheckCircle2 },
  peringatan: { kartu: "bg-warn-fill", teks: "text-warn-text", Ikon: TimerOff },
  info: { kartu: "bg-info-fill", teks: "text-info-text", Ikon: Stethoscope },
  netral: { kartu: "bg-muted", teks: "text-muted-foreground", Ikon: Clock },
} as const;

/**
 * Kartu status absen masuk: jam, ketepatan waktu, dan validitas lokasi —
 * tiga hal yang ditanyakan atasan saat memeriksa kehadiran.
 */
export function KartuStatusMasuk({
  absen,
  jamAturan,
}: {
  absen: AbsensiHariIni;
  jamAturan: string;
}) {
  const { judul, nada } = ringkasan(absen, jamAturan);
  const gaya = NADA[nada];
  const Ikon = gaya.Ikon;

  return (
    <Card
      className={cn("kartu-interaktif h-full rounded-2xl ring-0", gaya.kartu)}
    >
      <div className="px-4">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-[11px] leading-[14px] font-semibold tracking-[0.04em] uppercase",
              gaya.teks,
            )}
          >
            Absen Masuk
          </p>
          <LogIn className={cn("size-3.5 shrink-0", gaya.teks)} />
        </div>

        <p
          className={cn(
            "tabular mt-1 text-2xl leading-[30px] font-bold tracking-tight",
            gaya.teks,
          )}
        >
          {absen.jamMasuk
            ? jamWib(absen.jamMasuk).replace(" WIB", "")
            : "--:--"}
          <span className="ml-1 text-[11px] leading-[14px] font-medium">
            WIB
          </span>
        </p>

        <p
          className={cn(
            "mt-1.5 flex items-start gap-1 text-[11px] leading-[14px] font-medium",
            gaya.teks,
          )}
        >
          <Ikon className="mt-px size-3 shrink-0" />
          <span className="text-pretty">{judul}</span>
        </p>

        {absen.jamMasuk ? (
          <p className="mt-1 flex items-center gap-1 text-[11px] leading-[14px]">
            {absen.lokasiValid ? (
              <>
                <MapPin className="size-3 shrink-0 text-ok-text" />
                <span className="text-ok-text">
                  Dalam radius
                  {absen.jarakMeter !== null
                    ? ` · ${Math.round(absen.jarakMeter)} m`
                    : ""}
                </span>
              </>
            ) : (
              <>
                <MapPinOff className="size-3 shrink-0 text-danger-text" />
                <span className="font-semibold text-danger-text">
                  Di luar radius kantor
                  {absen.jarakMeter !== null
                    ? ` · ${Math.round(absen.jarakMeter)} m`
                    : ""}
                </span>
              </>
            )}
          </p>
        ) : null}

        {absen.alasan ? (
          <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
            {absen.alasan}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
