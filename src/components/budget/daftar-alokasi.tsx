import { Card } from "@/components/ui/card";
import { AksiAlokasi } from "@/components/budget/aksi-alokasi";
import { cn } from "@/lib/utils";
import { rupiahRingkas, tanggalPendek } from "@/lib/format";
import {
  GAYA_STATUS_ALOKASI,
  LABEL_STATUS_ALOKASI,
  type AlokasiAnggaran,
} from "@/lib/budget";
import { LABEL_JENIS_KELUAR } from "@/lib/keuangan";

/**
 * Pengajuan alokasi tambahan beserta keadaannya.
 *
 * Yang menunggu keputusan ditaruh paling atas: pengajuan yang mengendap
 * adalah belanja yang tertahan, dan itu berbiaya walau tidak terlihat
 * di laporan mana pun.
 */
export function DaftarAlokasi({
  daftar,
  peran,
  namaSaya,
}: {
  daftar: AlokasiAnggaran[];
  /** Peran pembaca; menentukan siapa yang boleh memutuskan. */
  peran: string;
  namaSaya: string;
}) {
  if (daftar.length === 0) return null;

  const urut = [...daftar].sort((a, b) => {
    const menunggu = (x: AlokasiAnggaran) => (x.status === "diajukan" ? 0 : 1);
    return menunggu(a) - menunggu(b) || b.pada.localeCompare(a.pada);
  });
  const menunggu = urut.filter((a) => a.status === "diajukan").length;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Alokasi tambahan</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {menunggu === 0
            ? `${urut.length} pengajuan, semuanya sudah diputuskan.`
            : `${menunggu} pengajuan menunggu keputusan.`}
        </p>
      </div>

      <ul className="space-y-2 px-5">
        {urut.map((a) => (
          <li key={a.id} className="rounded-2xl bg-muted/50 p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-[10rem] flex-1">
                <p className="text-[13px] leading-[18px] font-semibold text-pretty">
                  {LABEL_JENIS_KELUAR[a.jenis]} · {a.unitNama}
                </p>
                <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  {a.alasan}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="tabular text-[13px] leading-[18px] font-semibold">
                  +{rupiahRingkas(a.jumlah)}
                </span>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                    GAYA_STATUS_ALOKASI[a.status],
                  )}
                >
                  {LABEL_STATUS_ALOKASI[a.status]}
                </span>
              </div>
            </div>

            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-[14px] text-muted-foreground">
              <span>{tanggalPendek(a.pada)}</span>
              {a.diajukanNama ? <span>diajukan {a.diajukanNama}</span> : null}
              {a.diputuskanNama ? (
                <span>diputuskan {a.diputuskanNama}</span>
              ) : null}
            </p>

            {a.catatanKeputusan ? (
              <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                {a.catatanKeputusan}
              </p>
            ) : null}

            <AksiAlokasi alokasi={a} peran={peran} namaSaya={namaSaya} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
