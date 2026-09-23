"use client";

import { EyeOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  GAYA_GOLONGAN,
  KUNCI_DIABAIKAN,
  KUNCI_REFERENSI,
  LABEL_GOLONGAN,
  type BarisUnggah,
} from "@/lib/ekspor-v1";

/** Sebab sebuah kunci tidak dipetakan, ditulis untuk dibaca orang. */
const SEBAB: Record<string, string> = {
  "gmv:targets": "Target lama; angkanya hanya dipakai menjelaskan selisih.",
  "affiliate:goal": "Goal lama; tidak menggantikan GRD yang berjalan sekarang.",
  "img:store": "Lampiran gambar; tidak ikut pindah, tetap di sistem lama.",
  activities: "Jejak aktivitas antarmuka lama, tanpa padanan di V2.",
  backup: "Cadangan berkala; menyalinnya hanya menggandakan data yang sama.",
  drive: "Tautan berkas luar, bukan data operasional.",
  template: "Templat tampilan sistem lama.",
  reports: "Hasil olahan, bukan sumbernya — dihitung ulang di V2.",
  targets: "Sisa mekanisme target lama sebelum GRD.",
  "app:settings": "Pengaturan aplikasi lama yang tidak berlaku di sini.",
};

/**
 * Kunci ekspor yang tidak dipetakan, beserta alasannya.
 *
 * Keputusan mengabaikan sebuah kunci sama pentingnya dengan keputusan
 * memetakannya, dan jauh lebih mudah dilupakan. Dituliskan di layar
 * supaya orang yang mencari data lamanya menemukan jawabannya di sini —
 * bukan menyimpulkan bahwa migrasinya rusak.
 *
 * Yang "belum dikenali" sengaja tidak diberi alasan: sistem tidak tahu,
 * dan pura-pura tahu adalah cara paling rapi kehilangan data.
 */
export function PanelKunciDiabaikan({ baris }: { baris: BarisUnggah[] }) {
  const terbaca = new Map(baris.map((b) => [b.kunci, b]));
  const ada = baris.length > 0;
  const asing = baris.filter((b) => b.golongan === "asing");
  const daftar = [...KUNCI_REFERENSI, ...KUNCI_DIABAIKAN];

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <EyeOff className="size-4 text-muted-foreground" />
          Kunci yang tidak dipetakan
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Dua kunci hanya dicatat sebagai rujukan angka lama; delapan sisanya
          tidak disimpan sama sekali. Ini keputusan, bukan kegagalan — dan
          alasannya ditulis supaya bisa ditinjau ulang.
        </p>
      </div>

      <ul className="space-y-1 px-5">
        {daftar.map((kunci) => {
          const isi = terbaca.get(kunci);
          const golongan = (KUNCI_REFERENSI as readonly string[]).includes(
            kunci,
          )
            ? "referensi"
            : "diabaikan";
          return (
            <li
              key={kunci}
              className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-2xl bg-muted/50 px-4 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[11px] leading-[14px] break-all">
                  {kunci}
                </span>
                <span className="block text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  {SEBAB[kunci]}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-1.5">
                {ada ? (
                  <span className="tabular rounded-full bg-muted px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-muted-foreground">
                    {isi ? `${isi.jumlah} entri` : "tidak ada"}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
                    GAYA_GOLONGAN[golongan],
                  )}
                >
                  {LABEL_GOLONGAN[golongan]}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {asing.length > 0 ? (
        <div className="px-5">
          <p className="rounded-2xl bg-warn-fill px-4 py-2.5 text-[13px] leading-[18px] text-pretty text-warn-text">
            {asing.length} kunci di berkas ini tidak ada di ketiga daftar.
            Isinya ikut tersimpan mentah supaya tidak hilang, tetapi tidak akan
            dipetakan sebelum ada yang memutuskan ke mana perginya.
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {asing.map((b) => (
              <li
                key={b.kunci}
                className="tabular rounded-full bg-warn-fill px-2.5 py-1 font-mono text-[11px] leading-[14px] font-semibold text-warn-text"
              >
                {b.kunci} · {b.jumlah}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
