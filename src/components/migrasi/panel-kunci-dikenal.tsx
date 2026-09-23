"use client";

import { KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { KUNCI_DIKENAL, type BarisUnggah } from "@/lib/ekspor-v1";

/**
 * Daftar kunci ekspor yang punya tempat di skema V2.
 *
 * Ekspor K-Space lama memuat jauh lebih banyak kunci daripada yang
 * dipetakan. Tanpa daftar ini, satu-satunya cara mengetahui apakah
 * sebuah kunci akan terbawa adalah membaca kode pemetaan — dan kunci
 * yang diam-diam tidak terbawa baru ketahuan berbulan-bulan kemudian,
 * saat datanya dicari dan tidak ada.
 *
 * Karena itu kesebelasnya disebut apa adanya beserta apa yang akan
 * terjadi pada isinya, dan setelah sebuah berkas diunggah tiap baris
 * memberi tahu berapa entri yang benar-benar ditemukan di berkas itu.
 */
export function PanelKunciDikenal({
  baris,
  sumber,
}: {
  /** Kunci yang terbaca — dari unggahan barusan atau dari kv_store_lama. */
  baris: BarisUnggah[];
  /** Dari mana daftarnya berasal; null bila belum ada apa-apa. */
  sumber: string | null;
}) {
  const terbaca = new Map(baris.map((b) => [b.kunci, b]));
  const ada = baris.length > 0;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <KeyRound className="size-4 text-muted-foreground" />
          Kunci yang dipetakan
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {ada
            ? `Dibaca dari ${sumber ?? "ekspor lama"}. Angka di kanan adalah jumlah entri yang ditemukan pada kunci itu.`
            : `${KUNCI_DIKENAL.length} kunci tingkat atas ekspor lama yang punya tempat di skema V2. Selebihnya tidak terbawa.`}
        </p>
      </div>

      <ul className="space-y-1 px-5">
        {KUNCI_DIKENAL.map((k) => {
          const isi = terbaca.get(k.kunci);
          return (
            <li
              key={k.kunci}
              className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-2xl bg-muted/50 px-4 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[11px] leading-[14px] break-all">
                  {k.kunci}
                </span>
                <span className="block text-[13px] leading-[18px] font-semibold">
                  {k.label}
                </span>
                <span className="block text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  {k.catatan}
                </span>
              </span>

              {ada ? (
                <span
                  className={cn(
                    "tabular shrink-0 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
                    isi
                      ? "bg-ok-fill text-ok-text"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {isi ? `${isi.jumlah} entri` : "tidak ada di berkas"}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
