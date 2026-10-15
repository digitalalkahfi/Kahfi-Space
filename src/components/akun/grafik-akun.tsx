"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GrafikBanding } from "@/components/shared/grafik-banding";
import type { GarisSeri, SatuanGrafik, TitikGrafik } from "@/lib/grafik";
import type { MetrikGrafik } from "@/lib/detail-akun";

export type DeretMetrik = {
  sekarang: TitikGrafik[];
  /** null: periode lalu tanpa laporan — garisnya tidak digambar (E1). */
  lalu: TitikGrafik[] | null;
};

const TAB: { kunci: MetrikGrafik; label: string; satuan: SatuanGrafik }[] = [
  { kunci: "gmv", label: "GMV", satuan: "rupiah" },
  { kunci: "komisi", label: "Komisi", satuan: "rupiah" },
  { kunci: "upload", label: "Upload", satuan: "angka" },
];

/**
 * Grafik utama halaman akun (§5.2 no. 4): satu grafik, tab metrik.
 *
 * Garis periode ini tebal, periode lalu putus-putus; hari tanpa
 * laporan adalah celah, bukan nol. Tab Komisi hanya ada bila halaman
 * memberikan deret komisi — dan halaman hanya memberikannya kepada yang
 * boleh melihat komisi akun ini.
 */
export function GrafikAkun({
  deret,
  minimum,
  perBulan,
  labelLalu,
}: {
  deret: Partial<Record<MetrikGrafik, DeretMetrik>>;
  /** Batas minimum upload per hari; garisnya hanya pada grafik harian. */
  minimum: number | null;
  perBulan: boolean;
  labelLalu: string;
}) {
  const tersedia = TAB.filter((t) => deret[t.kunci]);
  const [aktif, setAktif] = useState<MetrikGrafik>("gmv");
  const tab = tersedia.find((t) => t.kunci === aktif) ?? tersedia[0];
  const d = deret[tab.kunci] as DeretMetrik;

  const kosongSemua = d.sekarang.every((t) => t.kosong);
  const seri: GarisSeri[] = [
    {
      kunci: tab.kunci,
      label: `${tab.label} periode ini`,
      warna: "stroke-primary",
      warnaLegenda: "bg-primary",
      satuan: tab.satuan,
      titik: d.sekarang,
    },
    ...(d.lalu
      ? [
          {
            kunci: `${tab.kunci}-lalu`,
            label: labelLalu,
            warna: "stroke-muted-foreground/60",
            warnaLegenda: "bg-muted-foreground/60",
            satuan: tab.satuan,
            putus: true,
            titik: d.lalu,
          },
        ]
      : []),
    // AC10: garis batas minimum level di tab Upload (per hari saja —
    // jumlah sebulan tidak bisa dibandingkan dengan batas harian).
    ...(tab.kunci === "upload" && minimum !== null && !perBulan
      ? [
          {
            kunci: "minimum",
            label: `Batas minimum (${minimum}/hari)`,
            warna: "stroke-danger/70",
            warnaLegenda: "bg-danger/70",
            satuan: "angka" as const,
            putus: true,
            titik: d.sekarang.map((t) => ({ label: t.label, nilai: minimum })),
          },
        ]
      : []),
  ];

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-3 px-5">
        <div
          role="tablist"
          aria-label="Metrik grafik"
          className="inline-flex gap-1 rounded-full bg-muted p-1"
        >
          {tersedia.map((t) => (
            <button
              key={t.kunci}
              type="button"
              role="tab"
              aria-selected={t.kunci === tab.kunci}
              onClick={() => setAktif(t.kunci)}
              className={cn(
                "tekan-halus h-8 rounded-full px-3 text-[12px] font-semibold",
                t.kunci === tab.kunci
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {kosongSemua ? (
          <p className="rounded-2xl bg-muted/50 p-4 text-[13px] leading-[18px] text-muted-foreground">
            Belum ada laporan akun ini di periode ini.
          </p>
        ) : d.sekarang.length < 2 ? (
          <p className="rounded-2xl bg-muted/50 p-4 text-[13px] leading-[18px] text-muted-foreground">
            Baru satu titik pada periode ini — garis butuh setidaknya dua.
          </p>
        ) : (
          <div className="rounded-2xl bg-muted/50 p-3 sm:p-4">
            <GrafikBanding
              judul={`${tab.label} ${perBulan ? "per bulan" : "per hari"}`}
              petunjuk="Arahkan kursor / sentuh grafik"
              seri={seri}
            />
          </div>
        )}
        {tab.kunci === "upload" && minimum !== null && perBulan ? (
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Batas minimum level akun ini: {minimum} upload per hari kerja.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
