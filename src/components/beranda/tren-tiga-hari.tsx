import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { bilangan, tanggalPendek } from "@/lib/format";
import {
  GAYA_MINIMUM,
  type ArahTren,
  type TrenTigaHari,
} from "@/lib/batas-minimum";

const GAYA_ARAH: Record<
  ArahTren,
  { ikon: typeof ArrowUpRight; teks: string; label: string }
> = {
  naik: { ikon: ArrowUpRight, teks: "text-ok-text", label: "Naik" },
  turun: { ikon: ArrowDownRight, teks: "text-danger-text", label: "Turun" },
  datar: { ikon: ArrowRight, teks: "text-muted-foreground", label: "Datar" },
};

/**
 * Tren tiga hari kerja terakhir tiap akun yang dipegang sendiri.
 *
 * Angka sebulan menjawab "seberapa patuh"; tiga hari terakhir menjawab
 * "sedang membaik atau memburuk" — dan yang kedua itulah yang masih bisa
 * diperbaiki hari ini.
 *
 * "Tiga hari terakhir" berarti tiga HARI KERJA, bukan tiga hari
 * kalender: kalau tidak, akhir pekan akan selalu terbaca sebagai dua
 * hari di bawah minimum.
 */
export function TrenTigaHariAkun({ tren }: { tren: TrenTigaHari[] }) {
  const dinilai = tren.filter((t) => t.minimum !== null && t.hariDinilai > 0);
  if (dinilai.length === 0) return null;

  return (
    <section className="rounded-2xl bg-muted/50 p-3">
      <h3 className="text-[13px] leading-[18px] font-semibold">
        Tren tiga hari terakhir
      </h3>
      <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
        Tiga hari kerja terakhir tiap akun — hari libur dan izin yang disetujui
        tidak ikut dihitung.
      </p>

      <ul className="mt-2 space-y-2">
        {dinilai.map((t) => {
          const arah = t.arah ? GAYA_ARAH[t.arah] : null;
          const Ikon = arah?.ikon ?? Minus;
          return (
            <li
              key={t.akunId}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <Ikon
                  className={cn(
                    "size-3.5 shrink-0",
                    arah?.teks ?? "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <span className="truncate text-[13px] leading-[18px] font-semibold">
                  {t.username}
                </span>
                <span className="tabular shrink-0 text-[11px] leading-[14px] text-muted-foreground">
                  min. {bilangan(t.minimum ?? 0)}
                </span>
              </div>

              <ol className="flex shrink-0 items-center gap-1">
                {t.hari.map((h) => (
                  <li
                    key={h.tanggal}
                    title={`${tanggalPendek(h.tanggal)}: ${
                      h.unggahan === null
                        ? "tidak ada laporan"
                        : `${bilangan(h.unggahan)} unggahan`
                    }`}
                    className={cn(
                      "tabular rounded-md px-1.5 py-0.5 text-[11px] leading-[14px] font-semibold",
                      GAYA_MINIMUM[h.terpenuhi ? "terpenuhi" : "kurang"].pil,
                    )}
                  >
                    {h.unggahan === null ? "—" : bilangan(h.unggahan)}
                  </li>
                ))}
              </ol>

              {/* Kalimatnya dibaca pembaca layar; deret kotak di atas
                  tidak berarti apa-apa tanpa ini. */}
              <p className="sr-only">
                {t.username}: {arah?.label ?? "belum ada tren"},{" "}
                {t.jumlahTerpenuhi} dari {t.hariDinilai} hari memenuhi batas
                minimum {bilangan(t.minimum ?? 0)}.
                {t.beruntunKurang > 0
                  ? ` ${t.beruntunKurang} hari terakhir berturut-turut di bawah minimum.`
                  : ""}
              </p>

              {t.beruntunKurang >= 2 ? (
                <p className="w-full text-[11px] leading-[14px] font-semibold text-warn-text">
                  {t.beruntunKurang} hari berturut-turut di bawah minimum.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
