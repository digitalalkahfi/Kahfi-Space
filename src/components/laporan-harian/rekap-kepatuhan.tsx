"use client";

import { useState } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bilangan, persen } from "@/lib/format";
import { GAYA_MINIMUM } from "@/lib/batas-minimum";
import {
  rekapMinimumPerAkun,
  rekapMinimumPerOrang,
  ringkasanRekapMinimum,
  type BarisRekap,
} from "@/lib/rekap-minimum";

const KELOMPOK = [
  { kunci: "akun", label: "Per akun" },
  { kunci: "orang", label: "Per orang" },
] as const;

type Kelompok = (typeof KELOMPOK)[number]["kunci"];

/**
 * Rekap kepatuhan batas minimum pada daftar yang sedang dilihat.
 *
 * Tabel riwayat menjawab "hari itu berapa"; rekap ini menjawab "siapa
 * yang perlu ditindaklanjuti". Karena itu urutannya dari yang paling
 * bermasalah, dan penyebutnya disebut apa adanya — "2 dari 3 laporan",
 * bukan persentase kepatuhan yang terdengar seperti menghitung seluruh
 * hari kerja. Hari kerja tanpa laporan dinilai di tempat lain.
 *
 * Per akun dan per orang dua pertanyaan berbeda: akun mana yang sepi,
 * dan siapa yang membuatnya sepi. Satu orang bisa memegang beberapa
 * akun, jadi keduanya tidak bisa disimpulkan dari yang lain.
 *
 * Tidak muncul sama sekali bila tidak ada akun berlevel di daftar ini:
 * Leader MCN & TAP tidak perlu kartu kosong.
 */
export function RekapKepatuhan({
  riwayat,
}: {
  riwayat: readonly BarisRekap[];
}) {
  const [kelompok, setKelompok] = useState<Kelompok>("akun");
  // Penyaring rekap berbeda dari penyaring tabel: yang disembunyikan di
  // sini adalah AKUN/ORANG yang tidak pernah kurang, bukan hari yang
  // memenuhi. Ringkasan di atasnya tetap dihitung dari semuanya —
  // penyebut yang ikut menyusut membuat "0 dari 37" yang menyesatkan.
  const [hanyaKurang, setHanyaKurang] = useState(false);

  const rekap =
    kelompok === "akun"
      ? rekapMinimumPerAkun(riwayat)
      : rekapMinimumPerOrang(riwayat);
  const ringkas = ringkasanRekapMinimum(rekap);
  if (ringkas === null) return null;

  const bermasalah = rekap.filter((r) => r.terpenuhi < r.laporan);
  const tampil = hanyaKurang ? bermasalah : rekap;

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-3 px-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2 className="text-base leading-6 font-semibold">
            Kepatuhan batas minimum
          </h2>
          <div
            role="group"
            aria-label="Tampilan rekap"
            className="flex items-center gap-1.5"
          >
            {KELOMPOK.map((k) => (
              <button
                key={k.kunci}
                type="button"
                onClick={() => setKelompok(k.kunci)}
                aria-pressed={k.kunci === kelompok}
                className={cn(
                  "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
                  k.kunci === kelompok
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
                )}
              >
                {k.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setHanyaKurang((v) => !v)}
              aria-pressed={hanyaKurang}
              // Halaman ini punya dua penyaring bernama sama — yang satu
              // menyaring hari, yang satu menyaring akun/orang. Pembaca
              // layar harus bisa membedakannya tanpa melihat letaknya.
              aria-label={`Hanya ${kelompok === "akun" ? "akun" : "orang"} yang pernah di bawah minimum`}
              className={cn(
                "tekan-halus sentuh-nyaman flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
                hanyaKurang
                  ? "bg-warn-fill text-warn-text ring-1 ring-warn-text/20"
                  : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
              )}
            >
              <TriangleAlert className="size-3" aria-hidden />
              Di bawah minimum
              <span className="tabular opacity-70">({bermasalah.length})</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] leading-[14px] text-muted-foreground">
          {ringkas.terpenuhi} dari {ringkas.laporan} laporan memenuhi batas
          minimum levelnya
          {ringkas.kurang > 0 ? ` · ${ringkas.kurang} di bawah minimum` : ""}
        </p>

        {tampil.length === 0 ? (
          <p className="rounded-2xl bg-ok-fill px-3 py-2 text-[13px] leading-[18px] font-semibold text-ok-text">
            Semuanya memenuhi batas minimum pada rentang ini.
          </p>
        ) : null}

        <ul className="grid gap-2 sm:grid-cols-2">
          {tampil.map((r) => {
            const bersih = r.terpenuhi === r.laporan;
            const gaya = GAYA_MINIMUM[bersih ? "terpenuhi" : "kurang"];
            return (
              <li
                key={r.kunci}
                className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] leading-[18px] font-semibold">
                    {r.label}
                  </p>
                  <p className="tabular text-[11px] leading-[14px] text-muted-foreground">
                    {r.minimum === null
                      ? "Beda level"
                      : `Min. ${bilangan(r.minimum)}`}{" "}
                    · {r.terpenuhi} dari {r.laporan} laporan
                    {r.kurangTerdalam > 0
                      ? ` · kurang ${bilangan(r.kurangTerdalam)} di hari terburuk`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "tabular flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                    gaya.pil,
                  )}
                >
                  {bersih ? (
                    <CheckCircle2 className="size-3" aria-hidden />
                  ) : (
                    <TriangleAlert className="size-3" aria-hidden />
                  )}
                  <span className="sr-only">
                    {bersih ? "Terpenuhi" : "Di bawah minimum"} —{" "}
                  </span>
                  {persen(r.rasio)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
