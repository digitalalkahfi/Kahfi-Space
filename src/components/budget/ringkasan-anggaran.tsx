import {
  PiggyBank,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas } from "@/lib/format";
import {
  ringkasAnggaran,
  type BandingPeriode,
  type BarisAnggaran,
} from "@/lib/budget";
import { bulanPendek } from "@/lib/format";

/**
 * Posisi anggaran satu periode: berapa yang dipagu, berapa yang sudah
 * keluar, dan berapa yang terikat tetapi belum dibayar.
 *
 * "Tertahan" ditampilkan terpisah karena ia bukan kas yang sudah pergi,
 * melainkan anggaran yang sudah tidak bisa dipakai lagi untuk hal lain.
 */
export function RingkasanAnggaran({
  baris,
  periode,
  banding,
}: {
  baris: BarisAnggaran[];
  periode: string;
  /** Pembanding periode sebelumnya; kosong bila tidak ada. */
  banding?: BandingPeriode;
}) {
  const r = ringkasAnggaran(baris);
  const terpakai = Math.min(100, r.rasio);
  const bermasalah = r.lewat > 0;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <PiggyBank className="size-4 text-muted-foreground" />
          Anggaran {periode}
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {r.jumlahBaris} pos anggaran · realisasi dihitung dari transaksi yang
          sudah dibayar.
        </p>
      </div>

      <div className="tabular px-5">
        <div className="rounded-2xl bg-muted/50 p-3.5">
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Terpakai dari {rupiahRingkas(r.anggaran)}
          </p>
          <p className="text-[22px] leading-7 font-bold tracking-tight">
            {rupiahRingkas(r.realisasi)}
          </p>

          <div
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border-subtle"
            role="img"
            aria-label={`${Math.round(r.rasio)} persen anggaran terpakai`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
                r.rasio > 100 ? "bg-danger" : "bg-secondary",
              )}
              style={{ width: `${terpakai}%` }}
            />
          </div>

          <p className="mt-1.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
            {Math.round(r.rasio)}% terpakai · sisa {rupiahRingkas(r.sisa)}
            {r.tertahan > 0
              ? ` · ${rupiahRingkas(r.tertahan)} sudah disetujui tetapi belum dibayar`
              : ""}
          </p>

          {/* Indikator selisih: satu angka serapan tidak memberi tahu
              arahnya — 93% bisa berarti membaik atau memburuk. */}
          {banding?.periode ? (
            <p
              className={cn(
                "mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                banding.selisihRasio > 0
                  ? "bg-warn-fill text-warn-text"
                  : "bg-ok-fill text-ok-text",
              )}
            >
              {banding.selisihRasio > 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {banding.selisihRasio > 0 ? "+" : "−"}
              {Math.abs(Math.round(banding.selisihRasio))} poin serapan vs{" "}
              {bulanPendek(banding.periode)}
              {banding.selisihRealisasi !== 0
                ? ` · ${banding.selisihRealisasi > 0 ? "+" : "−"}${rupiahRingkas(Math.abs(banding.selisihRealisasi))} belanja`
                : ""}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="tabular grid grid-cols-2 gap-2 px-5">
        <div
          className={cn(
            "rounded-2xl p-3",
            bermasalah ? "bg-danger-fill" : "bg-muted/50",
          )}
        >
          <dt
            className={cn(
              "flex items-center gap-1.5 text-[11px] leading-[14px]",
              bermasalah ? "text-danger-text" : "text-muted-foreground",
            )}
          >
            {bermasalah ? <TriangleAlert className="size-3" /> : null}
            Lewat anggaran
          </dt>
          <dd
            className={cn(
              "text-lg leading-6 font-bold tracking-tight",
              bermasalah && "text-danger-text",
            )}
          >
            {r.lewat}
          </dd>
          <dd
            className={cn(
              "text-[11px] leading-[14px] text-pretty",
              bermasalah ? "text-danger-text" : "text-muted-foreground",
            )}
          >
            {bermasalah
              ? "pos perlu penjelasan"
              : "semua pos masih di dalam pagu"}
          </dd>
        </div>

        <div className="rounded-2xl bg-muted/50 p-3">
          <dt className="text-[11px] leading-[14px] text-muted-foreground">
            Mendekati batas
          </dt>
          <dd className="text-lg leading-6 font-bold tracking-tight">
            {r.waspada}
          </dd>
          <dd className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
            sudah di atas 85% pagunya
          </dd>
        </div>
      </dl>
    </Card>
  );
}
