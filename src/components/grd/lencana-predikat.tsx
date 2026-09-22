import { cn } from "@/lib/utils";
import { AMBANG_PREDIKAT, gayaPredikatKpi } from "@/lib/unit";
import type { PredikatKpi } from "@/lib/kpi";

/**
 * Predikat KPI beserta warnanya.
 *
 * Warnanya menandai tingkat, bukan sekadar hiasan — jadi selalu
 * berpasangan dengan tulisan predikatnya, agar tetap terbaca oleh yang
 * tidak membedakan warna.
 */
export function LencanaPredikat({
  predikat,
  ukuran = "sedang",
  className,
}: {
  predikat: PredikatKpi;
  ukuran?: "kecil" | "sedang";
  className?: string;
}) {
  const gaya = gayaPredikatKpi[predikat];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        ukuran === "kecil"
          ? "px-2 py-0.5 text-[10px] leading-[14px]"
          : "px-2.5 py-1 text-[11px] leading-[14px]",
        gaya.kelas,
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", gaya.titik)} />
      {predikat}
    </span>
  );
}

/**
 * Predikat tanpa latar, untuk dipakai berdampingan dengan angka skor —
 * di sana latar penuh akan bersaing dengan angkanya.
 */
export function TandaPredikat({
  predikat,
  className,
}: {
  predikat: PredikatKpi;
  className?: string;
}) {
  const gaya = gayaPredikatKpi[predikat];

  return (
    <span
      className={cn(
        "flex items-center justify-end gap-1 text-[11px] leading-[14px] font-semibold",
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", gaya.titik)} />
      {predikat}
    </span>
  );
}

/**
 * Keterangan ambang keempat predikat pada skala 1.000.
 * Ambangnya ikut terlihat — justru itu isi penjelasannya.
 */
export function LegendaPredikat({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {AMBANG_PREDIKAT.map(({ predikat, label }) => (
        <li
          key={predikat}
          className="inline-flex items-center gap-1 rounded-full bg-card/10 pr-2"
        >
          <LencanaPredikat predikat={predikat} ukuran="kecil" />
          <span className="tabular text-[10px] leading-[14px] font-semibold opacity-70">
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
