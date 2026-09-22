import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/keuangan/sparkline";
import { cn } from "@/lib/utils";
import {
  LABEL_STATUS_KPI,
  formatNilaiKpi,
  formatPembandingKpi,
  formatNilaiPenuh,
  formatSelisihKpi,
  type KpiFinance,
  type StatusKpi,
} from "@/lib/kpi-finance";

const GAYA_STATUS: Record<StatusKpi, string> = {
  baik: "text-ok-text",
  waspada: "text-warn-text",
  buruk: "text-danger-text",
  netral: "text-muted-foreground",
};

const GAYA_LENCANA: Record<StatusKpi, string> = {
  baik: "bg-ok-fill text-ok-text",
  waspada: "bg-warn-fill text-warn-text",
  buruk: "bg-danger-fill text-danger-text",
  netral: "bg-muted text-muted-foreground",
};

function KartuKpi({ kpi }: { kpi: KpiFinance }) {
  const Panah =
    kpi.arah === "naik"
      ? ArrowUpRight
      : kpi.arah === "turun"
        ? ArrowDownRight
        : ArrowRight;

  return (
    <li className="rounded-2xl bg-muted/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] leading-[14px] text-muted-foreground">
          {kpi.label}
        </p>
        <Sparkline
          nilai={kpi.seri}
          naikBaik={kpi.kunci !== "budget-vs-actual"}
        />
      </div>
      {/* Angka penuh disimpan di `title`: yang diringkas tetap bisa
          diperiksa tanpa membuka halaman lain. */}
      <p
        title={formatNilaiPenuh(kpi)}
        className="tabular text-lg leading-6 font-bold tracking-tight"
      >
        {formatNilaiKpi(kpi)}
      </p>

      {kpi.selisih !== null ? (
        <p
          className={cn(
            "tabular mt-0.5 flex items-center gap-1 text-[11px] leading-[14px] font-semibold",
            GAYA_STATUS[kpi.status],
          )}
        >
          <Panah className="size-3" />
          {formatSelisihKpi(kpi)}
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] leading-[14px] text-muted-foreground">
          Tanpa pembanding
        </p>
      )}

      {/* Nilai pembandingnya ikut ditulis: selisih saja tidak memberi
          tahu dari titik mana ia bergerak. */}
      {formatPembandingKpi(kpi) ? (
        <p className="tabular mt-0.5 text-[11px] leading-[14px] text-muted-foreground">
          sebelumnya {formatPembandingKpi(kpi)}
        </p>
      ) : null}

      {kpi.status !== "netral" ? (
        <span
          className={cn(
            "mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
            GAYA_LENCANA[kpi.status],
          )}
        >
          {LABEL_STATUS_KPI[kpi.status]}
        </span>
      ) : null}

      <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
        {kpi.keterangan}
      </p>
    </li>
  );
}

/**
 * Sepuluh KPI keuangan berdampingan (PRD Fase 4).
 *
 * Tiap kartu membawa pembandingnya sendiri: angka satu periode hampir
 * tidak pernah cukup untuk memutuskan apa pun — yang menggerakkan
 * keputusan adalah arah perubahannya.
 */
export function GridKpi({
  daftar,
  labelPeriode,
  labelPembanding,
}: {
  daftar: KpiFinance[];
  labelPeriode: string;
  labelPembanding: string;
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">KPI keuangan</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          <span className="font-semibold text-foreground">{labelPeriode}</span>{" "}
          dibandingkan dengan {labelPembanding}. Laba bersih di sini sudah
          dipotong penyusutan — dasbor ini untuk memutuskan berapa yang bisa
          dibagikan, bukan untuk membaca arus kas.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-2 px-5 lg:grid-cols-5">
        {daftar.map((kpi) => (
          <KartuKpi key={kpi.kunci} kpi={kpi} />
        ))}
      </ul>
    </Card>
  );
}
