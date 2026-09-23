import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  kolomTanpaSumber,
  nilaiBaris,
  type BarisVerifikasi,
} from "@/lib/migrasi";

/**
 * Perbandingan jumlah baris: sumber, yang tercatat pindah, dan yang
 * benar-benar ada di tabel tujuan.
 *
 * Kolom terakhir itu yang penting. Log migrasi bisa saja menulis
 * "berhasil" sementara barisnya tidak pernah sampai — dan itu tidak
 * memunculkan galat apa pun sampai ada yang menghitung ulang.
 */
export function TabelVerifikasi({ daftar }: { daftar: BarisVerifikasi[] }) {
  const penilaian = daftar.map((b) => ({ baris: b, nilai: nilaiBaris(b) }));
  const bermasalah = penilaian.filter((p) => !p.nilai.cocok);

  return (
    <div className="space-y-4">
      <Card
        className={
          bermasalah.length === 0
            ? "rounded-3xl bg-ok-fill shadow-none ring-0"
            : "rounded-3xl bg-warn-fill shadow-none ring-0"
        }
      >
        <p
          className={cn(
            "flex items-start gap-2 px-5 text-[13px] leading-[18px] text-pretty",
            bermasalah.length === 0 ? "text-ok-text" : "text-warn-text",
          )}
        >
          {bermasalah.length === 0 ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          )}
          <span>
            {bermasalah.length === 0
              ? "Seluruh entitas cocok antara sumber dan tujuan."
              : `${bermasalah.length} entitas belum cocok: ${bermasalah
                  .map((p) => p.baris.label)
                  .join(", ")}.`}
          </span>
        </p>
      </Card>

      <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
        <div className="px-5">
          <h2 className="text-base leading-6 font-semibold">
            Perbandingan jumlah baris
          </h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Selisih tidak selalu berarti salah — entri yang sengaja dilewati
            memang tidak ikut pindah. Yang dicari adalah entri yang tercatat
            berhasil tapi barisnya tidak terbukti ada di tujuan.
          </p>
        </div>

        <ul className="space-y-2 px-5">
          {penilaian.map(({ baris, nilai }) => (
            <li
              key={baris.entitas}
              className={cn(
                "rounded-2xl p-3.5",
                nilai.cocok ? "bg-muted/50" : "bg-danger-fill/40",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[13px] leading-[18px] font-semibold">
                  {nilai.cocok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-ok-text" />
                  ) : (
                    <TriangleAlert className="size-4 shrink-0 text-danger-text" />
                  )}
                  {baris.label}
                </p>
                <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
                  {baris.tabelBaru}
                </p>
              </div>

              <dl className="tabular mt-2 grid grid-cols-2 gap-2 text-[11px] leading-[14px] sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Sumber</dt>
                  <dd className="font-semibold">{baris.sumber}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Berhasil</dt>
                  <dd className="font-semibold">{baris.berhasil}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Dilewati/gagal</dt>
                  <dd className="font-semibold">
                    {baris.dilewati}/{baris.gagal}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Terbukti ada</dt>
                  <dd className="font-semibold">{baris.tujuan}</dd>
                </div>
              </dl>

              <p
                className={cn(
                  "mt-1.5 text-[11px] leading-[14px] text-pretty",
                  nilai.cocok ? "text-muted-foreground" : "text-danger-text",
                )}
              >
                {nilai.keterangan}
              </p>

              {/* Kolom yang memang tidak ada di K-Space lama. Tanpa
                  keterangan ini, kolom kosong pada laporan lama terbaca
                  sebagai data yang hilang saat migrasi. */}
              {kolomTanpaSumber(baris.entitas).length > 0 ? (
                <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  Tetap kosong setelah pindah karena tidak ada di data lama:{" "}
                  <span className="font-mono">
                    {kolomTanpaSumber(baris.entitas).join(", ")}
                  </span>
                  .
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
