import { ArrowDown, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen, rupiahRingkas } from "@/lib/format";
import type { PengaruhLaba } from "@/lib/depresiasi";

function Batang({
  label,
  nilai,
  puncak,
  aksen,
}: {
  label: string;
  nilai: number;
  puncak: number;
  aksen: string;
}) {
  const lebar =
    puncak > 0 ? Math.max(0, Math.min(100, (nilai / puncak) * 100)) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-[13px] leading-[18px] text-muted-foreground">
          {label}
        </span>
        <span className="tabular text-[13px] leading-[18px] font-semibold">
          {rupiahRingkas(nilai)}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", aksen)}
          style={{ width: `${lebar}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Dampak penyusutan terhadap laba dan NPM.
 *
 * Dua angka laba ditampilkan berdampingan karena keduanya benar untuk
 * pertanyaan yang berbeda: yang sebelum penyusutan untuk membaca arus
 * kas, yang sesudah untuk memutuskan berapa yang benar-benar bisa
 * dibagikan. Menyembunyikan salah satunya membuat salah satu keputusan
 * itu diambil dengan angka yang keliru.
 */
export function DampakDepresiasi({ pengaruh }: { pengaruh: PengaruhLaba }) {
  const puncak = Math.max(pengaruh.labaSebelum, pengaruh.labaSesudah, 1);
  const rugi = pengaruh.labaSesudah < 0;

  // Berapa poin NPM yang tergerus tiap Rp 1 juta penyusutan — dipakai
  // menakar apakah rencana belanja aset berikutnya masih masuk akal.
  const poinPerJuta =
    pengaruh.beban > 0
      ? (Math.abs(pengaruh.selisihNpm) / pengaruh.beban) * 1_000_000
      : 0;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <Scale className="size-4 text-muted-foreground" />
          Dampak ke laba &amp; NPM
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Penyusutan tidak menyentuh kas, tetapi menentukan berapa laba yang
          benar-benar bisa dibagikan.
        </p>
      </div>

      <div className="space-y-2.5 px-5">
        <Batang
          label="Laba sebelum penyusutan"
          nilai={pengaruh.labaSebelum}
          puncak={puncak}
          aksen="bg-secondary"
        />

        <p className="flex items-center gap-1.5 text-[11px] leading-[14px] text-muted-foreground">
          <ArrowDown className="size-3" />
          Penyusutan bulan ini {rupiahRingkas(pengaruh.beban)}
        </p>

        <Batang
          label="Laba setelah penyusutan"
          nilai={Math.max(0, pengaruh.labaSesudah)}
          puncak={puncak}
          aksen={rugi ? "bg-danger" : "bg-ok"}
        />
      </div>

      <dl className="tabular grid grid-cols-2 gap-2 px-5">
        <div className="rounded-2xl bg-muted/50 p-3">
          <dt className="text-[11px] leading-[14px] text-muted-foreground">
            NPM sebelum
          </dt>
          <dd className="text-lg leading-6 font-bold tracking-tight">
            {persen(pengaruh.npmSebelum)}
          </dd>
        </div>

        <div
          className={cn(
            "rounded-2xl p-3",
            rugi ? "bg-danger-fill" : "bg-muted/50",
          )}
        >
          <dt
            className={cn(
              "text-[11px] leading-[14px]",
              rugi ? "text-danger-text" : "text-muted-foreground",
            )}
          >
            NPM sesudah
          </dt>
          <dd
            className={cn(
              "text-lg leading-6 font-bold tracking-tight",
              rugi && "text-danger-text",
            )}
          >
            {persen(pengaruh.npmSesudah)}
          </dd>
          <dd
            className={cn(
              "text-[11px] leading-[14px]",
              rugi ? "text-danger-text" : "text-muted-foreground",
            )}
          >
            {pengaruh.selisihNpm.toFixed(1)} poin
          </dd>
        </div>
      </dl>

      {poinPerJuta > 0 ? (
        <p className="px-5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
          Sebagai ancar-ancar: tiap Rp 1 juta beban penyusutan menggerus{" "}
          {poinPerJuta.toFixed(2)} poin NPM pada tingkat pendapatan sekarang —
          berguna saat menakar rencana pembelian aset berikutnya.
        </p>
      ) : null}
    </Card>
  );
}
