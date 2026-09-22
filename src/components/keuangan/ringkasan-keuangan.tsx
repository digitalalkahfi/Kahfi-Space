import { Banknote, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen, rupiahRingkas } from "@/lib/format";
import {
  BATAS_KAS_CEO,
  penyetujuiWajib,
  type RingkasKeuangan,
} from "@/lib/keuangan";

/**
 * Angka utama keuangan.
 *
 * NPM ditampilkan terhadap net revenue, bukan pendapatan kotor: itulah
 * sebab angka lama menyesatkan. Kas disorot tersendiri karena ia yang
 * menentukan siapa harus menyetujui pengeluaran berikutnya.
 */
export function RingkasanKeuangan({
  ringkas,
  sebelumnya,
  labelPembanding,
}: {
  ringkas: RingkasKeuangan;
  /** Periode pembanding; tanpa ini kartu hanya menunjukkan potret sesaat. */
  sebelumnya?: RingkasKeuangan;
  labelPembanding?: string;
}) {
  const kasTipis = ringkas.saldoKas < BATAS_KAS_CEO;
  const rugi = ringkas.labaBersih < 0;

  // Periode pembanding yang kosong bukan "naik 100%": tidak ada yang bisa
  // dibandingkan, dan menampilkannya hanya menyesatkan.
  const adaPembanding =
    sebelumnya !== undefined && sebelumnya.pendapatan + sebelumnya.beban > 0;

  const selisihLaba = adaPembanding
    ? ringkas.labaBersih - sebelumnya.labaBersih
    : null;
  const selisihNpm = adaPembanding ? ringkas.npm - sebelumnya.npm : null;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <Wallet className="size-4 text-muted-foreground" />
          Posisi keuangan
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {kasTipis
            ? `Kas di bawah ${rupiahRingkas(BATAS_KAS_CEO)}: seluruh pengeluaran wajib disetujui ${penyetujuiWajib(ringkas.saldoKas)}.`
            : `Kas di atas ${rupiahRingkas(BATAS_KAS_CEO)}; pengeluaran cukup disetujui ${penyetujuiWajib(ringkas.saldoKas)}.`}
        </p>
      </div>

      <dl className="tabular grid gap-2 px-5 sm:grid-cols-2">
        <div
          className={cn(
            "rounded-2xl p-3.5",
            kasTipis ? "bg-warn-fill" : "bg-muted/50",
          )}
        >
          <dt
            className={cn(
              "flex items-center gap-1.5 text-[11px] leading-[14px]",
              kasTipis ? "text-warn-text" : "text-muted-foreground",
            )}
          >
            <Banknote className="size-3" />
            Saldo kas
          </dt>
          <dd
            className={cn(
              "text-xl leading-7 font-bold tracking-tight",
              kasTipis ? "text-warn-text" : undefined,
            )}
          >
            {rupiahRingkas(ringkas.saldoKas)}
          </dd>
        </div>

        <div
          className={cn(
            "rounded-2xl p-3.5",
            rugi ? "bg-danger-fill" : "bg-ok-fill",
          )}
        >
          <dt
            className={cn(
              "flex items-center gap-1.5 text-[11px] leading-[14px]",
              rugi ? "text-danger-text" : "text-ok-text",
            )}
          >
            {rugi ? (
              <TrendingDown className="size-3" />
            ) : (
              <TrendingUp className="size-3" />
            )}
            Laba bersih
          </dt>
          <dd
            className={cn(
              "text-xl leading-7 font-bold tracking-tight",
              rugi ? "text-danger-text" : "text-ok-text",
            )}
          >
            {rupiahRingkas(ringkas.labaBersih)}
          </dd>
          <dd
            className={cn(
              "text-[11px] leading-[14px]",
              rugi ? "text-danger-text" : "text-ok-text",
            )}
          >
            NPM {persen(ringkas.npm)} dari net revenue
            {selisihNpm !== null && Math.abs(selisihNpm) >= 0.1
              ? ` · ${selisihNpm > 0 ? "naik" : "turun"} ${persen(Math.abs(selisihNpm))}`
              : ""}
          </dd>
          {selisihLaba !== null && selisihLaba !== 0 && labelPembanding ? (
            <dd
              className={cn(
                "text-[11px] leading-[14px]",
                rugi ? "text-danger-text" : "text-ok-text",
              )}
            >
              {selisihLaba > 0 ? "+" : "−"}
              {rupiahRingkas(Math.abs(selisihLaba))} dibanding {labelPembanding}
            </dd>
          ) : null}
        </div>
      </dl>

      <dl className="tabular grid grid-cols-2 gap-2 px-5 sm:grid-cols-4">
        {[
          { label: "Pendapatan", nilai: ringkas.pendapatan },
          { label: "Net revenue", nilai: ringkas.netRevenue },
          { label: "Beban", nilai: ringkas.beban },
          { label: "Aset dibeli", nilai: ringkas.aset },
        ].map((x) => (
          <div key={x.label} className="rounded-2xl bg-muted/50 p-3">
            <dt className="text-[11px] leading-[14px] text-muted-foreground">
              {x.label}
            </dt>
            <dd className="text-[13px] leading-[18px] font-semibold">
              {rupiahRingkas(x.nilai)}
            </dd>
          </div>
        ))}
      </dl>

      {ringkas.menungguPersetujuan > 0 ? (
        <p className="mx-5 rounded-2xl bg-muted px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
          {rupiahRingkas(ringkas.menungguPersetujuan)} pengeluaran masih
          menunggu persetujuan dan belum mengurangi kas.
        </p>
      ) : null}
    </Card>
  );
}
