"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Loader2,
  LockKeyhole,
  LogIn,
  LogOut,
  Navigation,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AmbilSelfie,
  type HasilSelfie,
} from "@/components/absensi/ambil-selfie";
import { KartuStatusMasuk } from "@/components/absensi/kartu-status-masuk";
import { KunciPulang } from "@/components/absensi/kunci-pulang";
import { useLokasi } from "@/components/absensi/use-lokasi";
import { MunculPop } from "@/components/motion/muncul-pop";
import { cn } from "@/lib/utils";
import { jamWib } from "@/lib/format";
import { absenMasuk, absenPulang } from "@/app/actions/absensi";
import { unggahSelfie } from "@/lib/data/selfie";
import { jarakMeter } from "@/lib/geo";
import type { AbsensiHariIni } from "@/lib/data/absensi";
import type { SasaranLaporan } from "@/lib/types";

type Tahap = "masuk" | "pulang" | "selesai";

function tahapDari(absen: AbsensiHariIni): Tahap {
  if (!absen.ada || !absen.jamMasuk) return "masuk";
  if (!absen.jamPulang) return "pulang";
  return "selesai";
}

/**
 * Alur absensi harian: masuk pagi, lalu pulang sore setelah laporan GMV
 * terkirim. Kunci Absen Pulang ditegakkan database; layar ini menjelaskan
 * alasannya supaya tidak terasa seperti tombol rusak.
 */
export function PanelAbsensi({
  absen,
  tanggal,
  radiusMeter,
  kantor,
  jamAturan,
  belumDilapor,
}: {
  absen: AbsensiHariIni;
  tanggal: string;
  radiusMeter: number;
  /** Jam masuk sesuai pengaturan, mis. "08:00". */
  jamAturan: string;
  /** Sasaran yang laporannya belum masuk hari ini. */
  belumDilapor: SasaranLaporan[];
  /** Titik kantor untuk pengecekan radius sebelum kirim. */
  kantor: { lat: number; lng: number };
}) {
  const tahap = tahapDari(absen);
  const [selfie, setSelfie] = useState<HasilSelfie | null>(null);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(
    null,
  );
  const [sibuk, mulai] = useTransition();
  const { keadaan, minta } = useLokasi();

  const terkunci = tahap === "pulang" && !absen.sudahLapor;

  const kirim = () => {
    if (sibuk || tahap === "selesai") return;
    setPesan(null);

    mulai(async () => {
      const titik = await minta();
      if (!titik) return;

      // Foto bersifat pelengkap: bila unggahannya gagal, absensi tetap jalan
      // dan pesannya disampaikan apa adanya.
      let fotoUrl: string | null = null;
      let catatanFoto = "";
      if (selfie) {
        const unggah = await unggahSelfie(selfie.blob, tanggal, tahap);
        if (unggah.ok) {
          fotoUrl = unggah.path;
        } else {
          catatanFoto = ` (${unggah.pesan})`;
        }
      }

      const hasil =
        tahap === "masuk"
          ? await absenMasuk({ tanggal, titik, fotoUrl })
          : await absenPulang({ tanggal, titik, fotoUrl });

      setPesan({
        ok: hasil.ok,
        teks: `${hasil.pesan ?? "Tersimpan."}${catatanFoto}`,
      });
    });
  };

  // Pratinjau jarak dihitung di klien supaya pengguna tahu SEBELUM mengirim;
  // penilaian yang mengikat tetap dilakukan database.
  const jarak =
    keadaan.status === "siap"
      ? jarakMeter(kantor.lat, kantor.lng, keadaan.titik.lat, keadaan.titik.lng)
      : null;
  const dalamRadius = jarak === null ? null : jarak <= radiusMeter;

  const lokasiTeks =
    keadaan.status === "siap"
      ? `${Math.round(jarak ?? 0)} m dari kantor · akurasi ±${keadaan.titik.akurasi} m`
      : keadaan.status === "mencari"
        ? "Mencari lokasi…"
        : keadaan.status === "gagal"
          ? keadaan.pesan
          : `Akan dicek terhadap radius ${radiusMeter} m dari kantor`;

  return (
    <div className="space-y-4">
      {/* Ringkasan hari ini ------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2">
        <KartuStatusMasuk absen={absen} jamAturan={jamAturan} />

        <MunculPop kunci={terkunci}>
          <Card
            className={cn(
              "kartu-interaktif h-full rounded-2xl ring-0",
              absen.jamPulang
                ? "bg-ok-fill"
                : terkunci
                  ? "bg-muted"
                  : "bg-info-fill",
            )}
          >
            <div className="px-4">
              <div className="flex items-start justify-between gap-2">
                <p
                  className={cn(
                    "text-[11px] leading-[14px] font-semibold tracking-[0.04em] uppercase",
                    absen.jamPulang
                      ? "text-ok-text"
                      : terkunci
                        ? "text-muted-foreground"
                        : "text-info-text",
                  )}
                >
                  Absen Pulang
                </p>
                {terkunci ? (
                  <LockKeyhole className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <LogOut
                    className={cn(
                      "size-3.5 shrink-0",
                      absen.jamPulang ? "text-ok-text" : "text-info-text",
                    )}
                  />
                )}
              </div>
              <p
                className={cn(
                  "tabular mt-1 text-2xl leading-[30px] font-bold tracking-tight",
                  absen.jamPulang
                    ? "text-ok-text"
                    : terkunci
                      ? "text-muted-foreground"
                      : "text-info-text",
                )}
              >
                {absen.jamPulang
                  ? jamWib(absen.jamPulang).replace(" WIB", "")
                  : "--:--"}
                <span className="ml-1 text-[11px] leading-[14px] font-medium">
                  WIB
                </span>
              </p>
              <p
                className={cn(
                  "mt-1.5 text-[11px] leading-[14px] font-semibold",
                  terkunci ? "text-danger-text" : "text-info-text",
                )}
              >
                {absen.jamPulang
                  ? "Kehadiran hari ini lengkap"
                  : terkunci
                    ? "Terkunci: wajib lapor GMV"
                    : "Siap diabsenkan"}
              </p>
            </div>
          </Card>
        </MunculPop>
      </div>

      {/* Alur absen --------------------------------------------------- */}
      {tahap === "selesai" ? (
        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <div className="space-y-2 px-5 py-2 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-fill text-ok-text">
              <CheckCircle2 className="size-6" />
            </span>
            <h2 className="text-base leading-6 font-semibold">
              Absensi hari ini lengkap
            </h2>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              Masuk {jamWib(absen.jamMasuk ?? "")} · pulang{" "}
              {jamWib(absen.jamPulang ?? "")}. Sampai besok!
            </p>
          </div>
        </Card>
      ) : terkunci ? (
        <KunciPulang belumDilapor={belumDilapor} />
      ) : (
        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <div className="px-5">
            <h2 className="text-base leading-6 font-semibold">
              {tahap === "masuk" ? "Absen masuk" : "Absen pulang"}
            </h2>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              Ambil selfie, lalu kirim. Lokasi dicek terhadap radius kantor.
            </p>
          </div>

          <div className="space-y-3 px-5">
            <AmbilSelfie
              onAmbil={setSelfie}
              hasil={selfie}
              nonaktif={sibuk}
              stempel={
                keadaan.status === "siap"
                  ? {
                      teks: `${keadaan.titik.lat.toFixed(4)}, ${keadaan.titik.lng.toFixed(4)} · ${Math.round(jarak ?? 0)} m`,
                      valid: dalamRadius,
                    }
                  : undefined
              }
            />

            <div className="space-y-1.5">
              <p
                className={cn(
                  "flex items-center gap-1.5 text-[11px] leading-[14px]",
                  dalamRadius === false
                    ? "font-semibold text-danger-text"
                    : "text-muted-foreground",
                )}
              >
                <Navigation className="size-3 shrink-0" />
                {lokasiTeks}
              </p>

              {keadaan.status === "kosong" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void minta()}
                  className="tekan-halus h-8 rounded-full px-3 text-[11px] font-semibold"
                >
                  <Navigation className="size-3" />
                  Cek lokasi saya
                </Button>
              ) : null}

              {dalamRadius === false ? (
                <p className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text">
                  Kamu di luar radius {radiusMeter} m. Absen tetap bisa dikirim,
                  tetapi akan ditandai di rekap dan bisa ditanyakan atasan.
                </p>
              ) : null}
            </div>

            {pesan ? (
              <p
                role="status"
                className={cn(
                  "rounded-xl px-4 py-2.5 text-[13px] leading-[18px]",
                  pesan.ok
                    ? "bg-ok-fill text-ok-text"
                    : "bg-warn-fill text-warn-text",
                )}
              >
                {pesan.teks}
              </p>
            ) : null}

            <Button
              type="button"
              onClick={kirim}
              disabled={sibuk}
              className="tekan-halus h-14 w-full rounded-full text-[13px] font-semibold"
            >
              {sibuk ? (
                <Loader2 className="size-4 animate-spin" />
              ) : tahap === "masuk" ? (
                <LogIn className="size-4" />
              ) : (
                <LogOut className="size-4" />
              )}
              {sibuk
                ? "Mengirim…"
                : tahap === "masuk"
                  ? "Absen masuk sekarang"
                  : "Absen pulang sekarang"}
            </Button>

            <p className="text-[11px] leading-[14px] text-muted-foreground">
              Selfie opsional bila kamera bermasalah, tetapi lokasi wajib.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
