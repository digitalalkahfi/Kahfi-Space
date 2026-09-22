import { CalendarRange, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen, rupiahRingkas } from "@/lib/format";
import { gayaUnit } from "@/lib/unit";
import type { Banding, RingkasGmv } from "@/lib/gmv";
import type { KodeUnit } from "@/lib/types";

const NAMA_UNIT: Record<KodeUnit, string> = {
  affiliator: "Affiliator",
  mcn: "MCN",
  tap: "TAP",
};

/** Laporan tanpa unit tetap punya nama, supaya tidak hilang diam-diam. */
function namaUnit(unitId: KodeUnit | null): string {
  return unitId ? NAMA_UNIT[unitId] : "Tanpa unit";
}

/** Satu angka besar dengan keterangannya. */
function Angka({
  label,
  nilai,
  catatan,
}: {
  label: string;
  nilai: string;
  catatan?: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/50 p-3">
      <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="tabular text-[19px] leading-[26px] font-bold tracking-tight">
        {nilai}
      </p>
      {catatan ? (
        <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
          {catatan}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Angka ringkas satu periode.
 *
 * Rata-rata sengaja diberi keterangan "per hari terlapor", bukan "per
 * hari": pekan yang laporannya bolong bukan pekan yang penjualannya
 * turun, dan perbedaan itu tidak boleh disembunyikan di balik satu
 * angka.
 */
export function RingkasanAngka({
  ringkas,
  banding,
  perUnit,
  pembanding,
}: {
  ringkas: RingkasGmv;
  banding: Banding;
  /** Sumbangan tiap lini pada total periode ini, terbesar lebih dulu. */
  perUnit: { unitId: KodeUnit | null; gmv: number }[];
  /** Periode sebelumnya yang dijadikan pembanding. */
  pembanding: {
    label: string;
    ringkas: RingkasGmv;
    /** Pembandingnya dipotong agar sepadan dengan periode berjalan. */
    dipotong: boolean;
  };
}) {
  const naik = banding.arah === "naik";
  // Periode berjalan hampir selalu punya lebih sedikit hari terlapor
  // daripada periode penuh sebelumnya, dan selisih persen yang lahir
  // dari situ bukan penurunan penjualan. Disebut terus terang, bukan
  // disembunyikan di balik satu angka merah.
  const hariTimpang =
    !banding.tanpaPembanding &&
    pembanding.ringkas.hariTerlapor > 0 &&
    ringkas.hariTerlapor < pembanding.ringkas.hariTerlapor;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-3 px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base leading-6 font-semibold">
              Ringkasan periode
            </h2>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Dihitung dari {ringkas.hariTerlapor} hari yang laporannya masuk.
            </p>
          </div>

          {banding.tanpaPembanding ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-muted-foreground">
              Tanpa pembanding
            </span>
          ) : (
            <span
              className={cn(
                "tabular inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
                banding.arah === "tetap"
                  ? "bg-muted text-muted-foreground"
                  : naik
                    ? "bg-ok-fill text-ok-text"
                    : "bg-danger-fill text-danger-text",
              )}
            >
              <TrendingUp
                className={cn("size-3", !naik && "rotate-180")}
                strokeWidth={2.5}
              />
              {naik ? "+" : ""}
              {persen(banding.persen, 1)} vs periode sebelumnya
            </span>
          )}
        </div>

        <div className="rounded-2xl bg-muted/50 p-3">
          <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Dibandingkan dengan
          </p>
          {banding.tanpaPembanding ? (
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              {pembanding.label} — tidak ada satu pun laporan pada periode itu,
              jadi tidak ada yang bisa dibandingkan.
            </p>
          ) : (
            <p className="text-[13px] leading-[18px] text-pretty">
              <span className="font-semibold">{pembanding.label}</span>
              <span className="tabular text-muted-foreground">
                {" · "}
                {rupiahRingkas(pembanding.ringkas.total)} dari{" "}
                {pembanding.ringkas.hariTerlapor} hari terlapor
              </span>
            </p>
          )}
          {pembanding.dipotong ? (
            <p className="mt-0.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
              Dipotong sampai hari yang sama supaya sepadan — periode ini belum
              selesai berjalan.
            </p>
          ) : null}
          {hariTimpang ? (
            <p className="mt-0.5 text-[11px] leading-[14px] text-pretty text-warn-text">
              Periode ini baru {ringkas.hariTerlapor} hari terlapor melawan{" "}
              {pembanding.ringkas.hariTerlapor} hari — selisihnya sebagian
              karena jumlah harinya, bukan hanya penjualannya. Rata-rata per
              hari lebih adil dibandingkan: {rupiahRingkas(ringkas.rataRata)} vs{" "}
              {rupiahRingkas(pembanding.ringkas.rataRata)}.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Angka
            label="Total GMV"
            nilai={rupiahRingkas(ringkas.total)}
            catatan={
              banding.tanpaPembanding
                ? "Periode sebelumnya tidak punya laporan"
                : `${banding.selisih >= 0 ? "+" : "−"}${rupiahRingkas(Math.abs(banding.selisih))} dari periode sebelumnya`
            }
          />
          <Angka
            label="Rata-rata"
            nilai={rupiahRingkas(ringkas.rataRata)}
            catatan="Per hari terlapor"
          />
          <Angka
            label="Tertinggi"
            nilai={
              ringkas.tertinggi ? rupiahRingkas(ringkas.tertinggi.gmv) : "—"
            }
            catatan={ringkas.tertinggi?.label}
          />
          <Angka
            label="Terendah"
            nilai={ringkas.terendah ? rupiahRingkas(ringkas.terendah.gmv) : "—"}
            catatan={ringkas.terendah?.label}
          />
        </div>

        {perUnit.length > 0 && ringkas.total > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              Sumbangan per lini
            </p>
            {/* Satu bilah berisi semua lini: yang dicari orang setelah
                melihat totalnya adalah lini mana yang menggerakkannya,
                dan itu paling cepat terbaca sebagai porsi, bukan daftar
                angka terpisah. */}
            <div
              className="flex h-2 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={perUnit
                .map(
                  (u) =>
                    `${namaUnit(u.unitId)} ${rupiahRingkas(u.gmv)} (${persen((u.gmv / ringkas.total) * 100, 0)})`,
                )
                .join(", ")}
            >
              {perUnit.map((u) => (
                <span
                  key={u.unitId ?? "lainnya"}
                  className={cn(
                    "h-full",
                    u.unitId ? gayaUnit[u.unitId].bar : "bg-muted-foreground",
                  )}
                  style={{ width: `${(u.gmv / ringkas.total) * 100}%` }}
                />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {perUnit.map((u) => (
                <li
                  key={u.unitId ?? "lainnya"}
                  className="flex items-center gap-1.5 text-[11px] leading-[14px]"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      u.unitId ? gayaUnit[u.unitId].bar : "bg-muted-foreground",
                    )}
                  />
                  <span className="font-semibold">{namaUnit(u.unitId)}</span>
                  <span className="tabular text-muted-foreground">
                    {rupiahRingkas(u.gmv)} ·{" "}
                    {persen((u.gmv / ringkas.total) * 100, 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {ringkas.totalTarget > 0 ? (
          <p className="flex items-start gap-2 text-[11px] leading-[14px] text-pretty text-muted-foreground">
            <CalendarRange className="mt-0.5 size-3.5 shrink-0" />
            {persen(ringkas.capaian)} dari akumulasi target harian pada
            hari-hari yang terlapor ({rupiahRingkas(ringkas.totalTarget)}).
            Target yang dipakai adalah target berjalan hari ini, bukan target
            masing-masing tanggal — sistem tidak menyimpan target per hari.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
