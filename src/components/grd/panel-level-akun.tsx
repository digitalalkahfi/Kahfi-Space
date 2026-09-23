"use client";

import { useState } from "react";
import { ChevronDown, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { bilangan, persen, tanggalPendek } from "@/lib/format";
import { GAYA_MINIMUM } from "@/lib/batas-minimum";
import { DialogLevelAkun } from "@/components/grd/dialog-level-akun";
import type { AkunKelola } from "@/lib/data/akun";

/**
 * Panel level akun: level, batas minimumnya, kepatuhan bulan berjalan,
 * dan riwayat perubahan levelnya.
 *
 * Empat hal itu satu cerita — "standarnya apa, dipenuhi tidak, dan
 * sejak kapan standarnya segitu" — jadi ditaruh berdampingan. Riwayat
 * levelnya disembunyikan di balik pengungkap karena ia jarang dibuka
 * tapi menentukan saat dibutuhkan: angka kepatuhan bulan lalu tidak
 * bisa dinilai tanpa tahu levelnya waktu itu berapa.
 *
 * Akun tanpa level tidak menampilkan apa pun selain ajakan menetapkannya:
 * tanpa standar, tidak ada yang bisa dinilai.
 */
export function PanelLevelAkun({
  akun,
  bolehKelola,
}: {
  akun: AkunKelola;
  /** Hanya CEO & Manager yang boleh menyetel level (aksi `ubahLevelAkun`). */
  bolehKelola: boolean;
}) {
  const [buka, setBuka] = useState(false);
  const [bukaUbah, setBukaUbah] = useState(false);

  if (akun.level === null || akun.minimum === null) {
    return (
      <>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] leading-[14px] text-muted-foreground">
          <Gauge className="size-3 shrink-0" aria-hidden />
          Level belum ditetapkan — unggahannya belum dinilai terhadap batas
          minimum apa pun.
          {bolehKelola ? (
            <button
              type="button"
              onClick={() => setBukaUbah(true)}
              className="tekan-halus font-semibold text-secondary underline-offset-2 hover:underline"
            >
              Tetapkan level
            </button>
          ) : null}
        </p>
        {bolehKelola ? (
          <DialogLevelAkun akun={akun} buka={bukaUbah} onBuka={setBukaUbah} />
        ) : null}
      </>
    );
  }

  const { kepatuhan } = akun;
  // Tanpa satu pun hari kerja pada rentang ini, tidak ada rasio yang
  // bisa disebut — dan nol persen akan terbaca sebagai "tidak patuh".
  const dinilai = kepatuhan.rasio !== null;
  const gaya =
    GAYA_MINIMUM[
      dinilai && (kepatuhan.rasio ?? 0) >= 100 ? "terpenuhi" : "kurang"
    ];

  return (
    <div className="mt-2 space-y-1.5">
      <p className="flex flex-wrap items-center gap-1.5 text-[11px] leading-[14px]">
        {bolehKelola ? (
          <button
            type="button"
            onClick={() => setBukaUbah(true)}
            className="tabular tekan-halus sentuh-nyaman rounded-full bg-accentmuted-fill px-2 py-0.5 font-semibold text-accentmuted-text hover:brightness-95"
          >
            Level {akun.level}
            <span className="sr-only"> — ubah level akun ini</span>
          </button>
        ) : (
          <span className="tabular rounded-full bg-accentmuted-fill px-2 py-0.5 font-semibold text-accentmuted-text">
            Level {akun.level}
          </span>
        )}
        <span className="tabular text-muted-foreground">
          min. {bilangan(akun.minimum)} unggahan/hari kerja
        </span>
        {dinilai ? (
          <span
            className={cn(
              "tabular rounded-full px-2 py-0.5 font-semibold",
              gaya.pil,
            )}
          >
            {persen(kepatuhan.rasio ?? 0)} patuh
            <span className="sr-only"> bulan berjalan</span>
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
            Belum ada hari kerja
          </span>
        )}
      </p>

      {dinilai ? (
        <p className="tabular text-[11px] leading-[14px] text-muted-foreground">
          {kepatuhan.terpenuhi} dari {kepatuhan.hariKerja} hari kerja bulan ini
          memenuhi batas minimum.
        </p>
      ) : null}

      {akun.jejakLevel.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setBuka((v) => !v)}
            aria-expanded={buka}
            className="tekan-halus sentuh-nyaman flex items-center gap-1 text-[11px] leading-[14px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "size-3 transition-transform",
                buka && "rotate-180",
              )}
              aria-hidden
            />
            Riwayat level ({akun.jejakLevel.length})
          </button>

          {buka ? (
            <ol className="mt-1 space-y-1 border-l border-border-subtle pl-2.5">
              {akun.jejakLevel.map((j) => (
                <li
                  key={j.id}
                  className="text-[11px] leading-[14px] text-muted-foreground"
                >
                  <span className="tabular font-semibold text-foreground">
                    {j.dari === null ? "Ditetapkan" : `${j.dari} → ${j.ke}`}
                  </span>
                  {j.dari === null ? ` level ${j.ke}` : ""} ·{" "}
                  {tanggalPendek(j.pada.slice(0, 10))}
                  {j.olehNama ? ` · oleh ${j.olehNama}` : ""}
                  {j.alasan ? ` · ${j.alasan}` : ""}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      {bolehKelola ? (
        <DialogLevelAkun akun={akun} buka={bukaUbah} onBuka={setBukaUbah} />
      ) : null}
    </div>
  );
}
