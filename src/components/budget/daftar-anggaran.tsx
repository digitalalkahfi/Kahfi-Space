import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DialogUbahAnggaran } from "@/components/budget/dialog-anggaran";
import { KeadaanKosong } from "@/components/shared/keadaan";
import { cn } from "@/lib/utils";
import { rupiahRingkas } from "@/lib/format";
import {
  GAYA_STATUS_ANGGARAN,
  LABEL_STATUS_ANGGARAN,
  judulAnggaran,
  type BarisAnggaran,
} from "@/lib/budget";
import type { PilihanOrganisasi } from "@/lib/types";

/**
 * Anggaran vs realisasi, satu baris per pos.
 *
 * Diurutkan dari yang paling dekat batasnya, bukan dari yang paling
 * besar nominalnya: pos kecil yang jebol lebih butuh perhatian daripada
 * pos besar yang baru terpakai separuh.
 */
export function DaftarAnggaran({
  baris,
  pilihan,
  bolehKelola,
}: {
  baris: BarisAnggaran[];
  pilihan: PilihanOrganisasi;
  /** Menetapkan pagu adalah wewenang Finance/Manager/CEO. */
  bolehKelola: boolean;
}) {
  if (baris.length === 0) {
    return (
      <KeadaanKosong
        ikon={<Wallet className="size-4" />}
        judul="Belum ada anggaran untuk periode ini"
        pesan="Anggaran ditetapkan per divisi per bulan; periode yang belum ditetapkan tidak dibandingkan dengan realisasi."
      />
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <h2 className="px-5 text-base leading-6 font-semibold">
        Anggaran per pos
      </h2>

      <ul className="space-y-2 px-5">
        {baris.map((b) => {
          const lebar = Math.min(100, Math.max(0, b.rasio));
          return (
            <li key={b.anggaran.id} className="rounded-2xl bg-muted/50 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div className="min-w-[10rem] flex-1">
                  <p className="text-[13px] leading-[18px] font-semibold text-pretty">
                    {judulAnggaran(b.anggaran)}
                  </p>
                  <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                    {b.anggaran.catatan}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex h-fit rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                      GAYA_STATUS_ANGGARAN[b.status],
                    )}
                  >
                    {LABEL_STATUS_ANGGARAN[b.status]}
                  </span>

                  {bolehKelola ? (
                    <DialogUbahAnggaran
                      anggaran={b.anggaran}
                      pilihan={pilihan}
                    />
                  ) : null}
                </div>
              </div>

              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-border-subtle"
                role="img"
                aria-label={`${Math.round(b.rasio)} persen terpakai`}
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    b.status === "lewat"
                      ? "bg-danger"
                      : b.status === "waspada"
                        ? "bg-warn"
                        : "bg-secondary",
                  )}
                  style={{ width: `${lebar}%` }}
                />
              </div>

              <p className="tabular mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-[14px] text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {rupiahRingkas(b.realisasi)}
                </span>
                <span>dari {rupiahRingkas(b.anggaran.jumlah)}</span>
                <span>{Math.round(b.rasio)}%</span>
                <span
                  className={cn(b.sisa < 0 && "font-semibold text-danger-text")}
                >
                  {b.sisa < 0
                    ? `lewat ${rupiahRingkas(Math.abs(b.sisa))}`
                    : `sisa ${rupiahRingkas(b.sisa)}`}
                </span>
                {b.tertahan > 0 ? (
                  <span>{rupiahRingkas(b.tertahan)} menunggu dibayar</span>
                ) : null}
              </p>

              {b.anggaran.disetujuiNama ? (
                <p className="mt-1 text-[11px] leading-[14px] text-muted-foreground">
                  Disetujui {b.anggaran.disetujuiNama}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
