import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen, tanggalPendek } from "@/lib/format";
import { gayaKeputusanWrm } from "@/lib/unit";
import { ARTI_WRM, keputusanWrm } from "@/lib/wrm";
import type { StatusWrm } from "@/lib/data/grd";
import type { LaporanMingguan } from "@/lib/data/grd";
import type { KeputusanWrm } from "@/lib/types";

/**
 * Empat kuadran matriks WRM, disusun sesuai dua sumbunya:
 * Hasil (GMV) naik ke atas, KRI (lead measure) naik ke kanan.
 */
const KUADRAN: {
  hasilHijau: boolean;
  kriHijau: boolean;
  keputusan: KeputusanWrm;
}[] = [
  { hasilHijau: true, kriHijau: false, keputusan: "SABAR" },
  { hasilHijau: true, kriHijau: true, keputusan: "LANJUT" },
  { hasilHijau: false, kriHijau: false, keputusan: "UBAH CARA" },
  { hasilHijau: false, kriHijau: true, keputusan: "ALARM" },
];

/**
 * Matriks WRM sebagai kuadran, bukan sekadar label.
 *
 * Posisi pekan berjalan ditandai, dan pekan-pekan sebelumnya ikut
 * diletakkan di kuadrannya masing-masing supaya arah geraknya terbaca —
 * satu pekan merah berbeda artinya dengan tiga pekan merah beruntun.
 */
export function MatriksWrm({
  wrm,
  riwayat = [],
}: {
  wrm: StatusWrm;
  riwayat?: LaporanMingguan[];
}) {
  // Pekan terbaru lebih dulu; cukup beberapa agar kuadrannya tidak sesak.
  const jejak = riwayat.slice(0, 4);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Matriks WRM</h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          Hasil (GMV) disilangkan dengan KRI (lead measure). Perpotongannya
          menentukan satu keputusan pekan ini.
        </p>
      </div>

      <div className="flex gap-2 px-5">
        {/* Sumbu tegak: hasil naik ke atas. */}
        <div
          aria-hidden
          className="flex w-5 shrink-0 flex-col items-center justify-between py-1"
        >
          <span className="text-[10px] leading-[14px] font-semibold text-ok-text">
            ▲
          </span>
          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Hasil GMV
          </span>
          <span className="text-[10px] leading-[14px] font-semibold text-danger-text">
            ▼
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-2 gap-2">
            {KUADRAN.map((k) => {
              const aktif =
                k.hasilHijau === wrm.hasilHijau && k.kriHijau === wrm.kriHijau;
              const gaya = gayaKeputusanWrm[k.keputusan];
              const pekan = jejak.filter(
                (w) => keputusanWrm(w.hasilHijau, w.kriHijau) === k.keputusan,
              );

              return (
                <div
                  key={k.keputusan}
                  aria-current={aktif ? "true" : undefined}
                  className={cn(
                    "flex min-h-24 flex-col rounded-2xl p-3 transition-colors",
                    aktif
                      ? `${gaya.kelas} ring-2 ring-current/25`
                      : "bg-muted/50 text-muted-foreground",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[11px] leading-[14px] font-semibold tracking-[0.04em] uppercase">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        aktif ? gaya.titik : "bg-muted-foreground/40",
                      )}
                    />
                    {k.keputusan}
                  </span>

                  <span className="mt-0.5 text-[10px] leading-[14px] opacity-80">
                    hasil {k.hasilHijau ? "hijau" : "merah"} · KRI{" "}
                    {k.kriHijau ? "hijau" : "merah"}
                  </span>

                  {pekan.length > 0 ? (
                    <span className="mt-auto flex flex-wrap gap-1 pt-2">
                      {pekan.map((w) => (
                        <span
                          key={w.periode}
                          title={`Pekan ${tanggalPendek(w.periode)}`}
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] leading-[14px] font-semibold",
                            aktif
                              ? "bg-card/70"
                              : "bg-card text-muted-foreground",
                          )}
                        >
                          {tanggalPendek(w.periode)}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Sumbu datar: KRI naik ke kanan. */}
          <div
            aria-hidden
            className="mt-1.5 flex items-center justify-between text-[10px] leading-[14px] font-semibold text-muted-foreground"
          >
            <span className="text-danger-text">◀ KRI merah</span>
            <span className="tracking-[0.06em] uppercase">Lead measure</span>
            <span className="text-ok-text">KRI hijau ▶</span>
          </div>
        </div>
      </div>

      <div className="px-5">
        <p className="rounded-2xl bg-muted px-4 py-3 text-[13px] leading-[18px] text-pretty">
          <span className="font-semibold">Pekan ini: {wrm.keputusan}</span> —{" "}
          {ARTI_WRM[wrm.keputusan]}
        </p>
        <p className="tabular mt-2 text-[11px] leading-[14px] text-muted-foreground">
          Hasil {persen(wrm.rasioHasil)} · KRI {persen(wrm.rasioKri)}
          {jejak.length > 0
            ? ` · ${jejak.length} pekan terakhir dipetakan`
            : ""}
        </p>
      </div>
    </Card>
  );
}
