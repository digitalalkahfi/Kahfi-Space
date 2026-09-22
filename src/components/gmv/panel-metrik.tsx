"use client";

import { useState } from "react";
import { Check, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen } from "@/lib/format";
import { GrafikBanding } from "@/components/shared/grafik-banding";
import { bandingkan, type MetrikGmv } from "@/lib/gmv";
import { teksSatuan, type GarisSeri } from "@/lib/grafik";

/**
 * Centang bawaan: GMV dan lini terbesarnya.
 *
 * Bukan semua metrik sekaligus. Grafik yang menyala dengan enam garis
 * memaksa orang menghapus dulu sebelum bisa melihat apa pun — dan yang
 * paling sering ditanyakan memang "totalnya ke mana, dan siapa yang
 * paling menentukan".
 */
function centangBawaan(metrik: MetrikGmv[]): string[] {
  const utama = metrik.find((m) => m.kunci === "gmv")?.kunci;
  const terbesar = metrik
    .filter((m) => m.kelompok === "lini")
    .sort((a, b) => b.nilai - a.nilai)[0]?.kunci;
  const pilihan = [utama, terbesar].filter((k): k is string => Boolean(k));
  return pilihan.length > 0 ? pilihan : metrik.slice(0, 1).map((m) => m.kunci);
}

/** Perbandingan satu metrik terhadap periode sebelumnya. */
function Tren({
  metrik,
  pembanding,
}: {
  metrik: MetrikGmv;
  pembanding: string;
}) {
  if (metrik.sebelumnya === null) {
    return (
      <span className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
        {metrik.catatan ?? "tanpa pembanding"}
      </span>
    );
  }

  const banding = bandingkan(metrik.nilai, metrik.sebelumnya);
  if (banding.tanpaPembanding) {
    return (
      <span className="text-[11px] leading-[14px] text-muted-foreground">
        tanpa pembanding
      </span>
    );
  }

  const naik = banding.arah === "naik";
  const tetap = banding.arah === "tetap";
  return (
    <span
      className={cn(
        "tabular flex flex-wrap items-center gap-x-1 text-[11px] leading-[14px] font-semibold",
        tetap
          ? "text-muted-foreground"
          : naik
            ? "text-ok-text"
            : "text-danger-text",
      )}
    >
      {tetap ? null : (
        <TrendingUp
          aria-hidden
          className={cn("size-3 shrink-0", !naik && "rotate-180")}
          strokeWidth={2.5}
        />
      )}
      {naik ? "+" : ""}
      {persen(banding.persen, 2)}
      <span className="font-normal text-muted-foreground">vs {pembanding}</span>
    </span>
  );
}

/**
 * Metrik utama: angka periode ini, dan grafik dari yang dicentang.
 *
 * Kartu dan grafik sengaja satu kartu: mencentang sesuatu di atas dan
 * garisnya muncul di bawah hanya terbaca sebagai sebab-akibat kalau
 * keduanya terlihat bersamaan.
 *
 * Pilihan centangnya tinggal di komponen ini, bukan di URL. Mengganti
 * periode berarti menarik data baru dari server; mengganti metrik yang
 * dilihat tidak — dan memaksanya lewat URL akan membuat tiap centang
 * memuat ulang halaman.
 */
export function PanelMetrik({
  metrik,
  pembanding,
  judulGrafik,
}: {
  metrik: MetrikGmv[];
  /** Nama periode pembandingnya, mis. "September 2024". */
  pembanding: string;
  judulGrafik: string;
}) {
  const [dipilih, setDipilih] = useState<string[]>(() => centangBawaan(metrik));
  const [tren, setTren] = useState(true);

  const alihkan = (kunci: string) =>
    setDipilih((lama) =>
      lama.includes(kunci) ? lama.filter((k) => k !== kunci) : [...lama, kunci],
    );

  // Urutan garis mengikuti urutan kartu, bukan urutan klik: grafik yang
  // menukar warna dan sumbu tiap kali dicentang ulang tidak bisa
  // diingat mata.
  const seri: GarisSeri[] = metrik
    .filter((m) => dipilih.includes(m.kunci))
    .map((m) => ({
      kunci: m.kunci,
      label: m.nama,
      warna: m.warna,
      warnaLegenda: m.warnaLegenda,
      satuan: m.satuan,
      putus: m.putus,
      titik: m.titik,
    }));

  const cukupTitik = (metrik[0]?.titik.length ?? 0) >= 2;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-3 px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base leading-6 font-semibold">Metrik utama</h2>

          <button
            type="button"
            role="switch"
            aria-checked={tren}
            onClick={() => setTren((v) => !v)}
            className="tekan-halus inline-flex items-center gap-2 text-[12px] leading-4 font-semibold"
          >
            <span
              aria-hidden
              className={cn(
                "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                tren ? "bg-ok" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-card shadow-sm transition-all",
                  tren ? "left-[1.125rem]" : "left-0.5",
                )}
              />
            </span>
            Tampilkan tren
          </button>
        </div>

        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {metrik.map((m) => {
            const aktif = dipilih.includes(m.kunci);
            return (
              <li key={m.kunci}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={aktif}
                  onClick={() => alihkan(m.kunci)}
                  className={cn(
                    "tekan-halus flex size-full flex-col items-start gap-1 rounded-2xl p-3 text-left ring-1 transition-colors",
                    aktif
                      ? "bg-muted/70 ring-border"
                      : "bg-muted/30 ring-transparent hover:bg-muted/50",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                        aktif
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      {aktif ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1.5 text-[12px] leading-4 font-semibold">
                      <span
                        aria-hidden
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          m.warnaLegenda,
                        )}
                      />
                      {m.nama}
                    </span>
                  </span>

                  <span className="tabular text-[19px] leading-[26px] font-bold tracking-tight">
                    {teksSatuan(m.nilai, m.satuan)}
                  </span>

                  {tren ? <Tren metrik={m} pembanding={pembanding} /> : null}
                </button>
              </li>
            );
          })}
        </ul>

        {!cukupTitik ? (
          <p className="rounded-2xl bg-muted/50 p-4 text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Baru satu titik pada periode ini — garis tren butuh setidaknya dua.
          </p>
        ) : seri.length === 0 ? (
          <p className="rounded-2xl bg-muted/50 p-4 text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Belum ada metrik yang dicentang. Pilih satu atau lebih di atas untuk
            menggambarnya.
          </p>
        ) : (
          <div className="rounded-2xl bg-muted/50 p-3 sm:p-4">
            <GrafikBanding
              judul={judulGrafik}
              petunjuk="Arahkan kursor / sentuh grafik"
              seri={seri}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
