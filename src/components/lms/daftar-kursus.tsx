import Link from "next/link";
import { BookOpen, CheckCircle2, Clock, GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TombolAktifKursus } from "@/components/lms/tombol-aktif-kursus";
import { cn } from "@/lib/utils";
import { persen } from "@/lib/format";
import {
  GAYA_TINGKAT,
  jumlahTuntas,
  LABEL_TINGKAT,
  persenKemajuan,
  ringkasBelajar,
  totalMenit,
  wajibBagi,
  type Kursus,
} from "@/lib/lms";
import type { Peran } from "@/lib/types";

/** Angka yang menyoroti pelatihan wajib yang belum tuntas. */
export function RingkasanBelajar({
  daftar,
  peran,
}: {
  daftar: Kursus[];
  peran: Peran;
}) {
  const r = ringkasBelajar(daftar, peran);
  const wajibTertunda = r.wajib - r.wajibSelesai;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <GraduationCap className="size-4 text-muted-foreground" />
          Belajarmu
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {wajibTertunda > 0
            ? `${wajibTertunda} pelatihan wajib belum tuntas.`
            : r.wajib > 0
              ? "Seluruh pelatihan wajibmu sudah tuntas."
              : "Tidak ada pelatihan yang diwajibkan untuk peranmu."}
        </p>
      </div>

      <dl className="tabular grid grid-cols-3 gap-2 px-5">
        <div
          className={cn(
            "rounded-2xl p-3",
            wajibTertunda > 0 ? "bg-warn-fill" : "bg-muted/50",
          )}
        >
          <dt
            className={cn(
              "text-[11px] leading-[14px]",
              wajibTertunda > 0 ? "text-warn-text" : "text-muted-foreground",
            )}
          >
            Wajib
          </dt>
          <dd
            className={cn(
              "text-lg leading-6 font-bold tracking-tight",
              wajibTertunda > 0 && "text-warn-text",
            )}
          >
            {r.wajibSelesai}/{r.wajib}
          </dd>
        </div>
        <div className="rounded-2xl bg-muted/50 p-3">
          <dt className="text-[11px] leading-[14px] text-muted-foreground">
            Berjalan
          </dt>
          <dd className="text-lg leading-6 font-bold tracking-tight">
            {r.berjalan}
          </dd>
        </div>
        <div className="rounded-2xl bg-muted/50 p-3">
          <dt className="text-[11px] leading-[14px] text-muted-foreground">
            Selesai
          </dt>
          <dd className="text-lg leading-6 font-bold tracking-tight">
            {r.selesai}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

/** Katalog kursus beserta kemajuan pengguna. */
export function DaftarKursus({
  daftar,
  peran,
  kelola = false,
}: {
  daftar: Kursus[];
  peran: Peran;
  /** CEO/Manager boleh memensiunkan kursus dari katalog ini. */
  kelola?: boolean;
}) {
  if (daftar.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada kursus yang tersedia.
        </p>
      </Card>
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <h2 className="px-5 text-base leading-6 font-semibold">Katalog kursus</h2>

      <ul className="space-y-2 px-5">
        {daftar.map((k) => {
          const kemajuan = persenKemajuan(k);
          const wajib = wajibBagi(k, peran);
          const lulus = k.selesaiPada !== null;

          return (
            <li
              key={k.id}
              className={cn(
                "rounded-2xl p-3.5",
                k.aktif ? "bg-muted/50" : "bg-muted/30 opacity-80",
              )}
            >
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-2xl",
                    lulus
                      ? "bg-ok-fill text-ok-text"
                      : "bg-card text-muted-foreground",
                  )}
                >
                  {lulus ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <BookOpen className="size-4" />
                  )}
                </span>

                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm leading-5 font-semibold text-pretty">
                    <Link href={`/lms/${k.id}`} className="hover:underline">
                      {k.judul}
                    </Link>
                  </p>
                  <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                    {k.ringkasan}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] leading-[14px] text-muted-foreground">
                    <Clock className="size-3 shrink-0" />
                    {k.modul.length} modul · {totalMenit(k)} menit ·{" "}
                    {k.unitNama}
                  </p>
                </div>

                <span className="flex h-fit shrink-0 flex-wrap gap-1">
                  {!k.aktif ? (
                    <span className="rounded-full bg-muted px-2 py-1 text-[10px] leading-[14px] font-semibold text-muted-foreground">
                      Dipensiunkan
                    </span>
                  ) : null}
                  {wajib ? (
                    <span className="rounded-full bg-danger-fill px-2 py-1 text-[10px] leading-[14px] font-semibold text-danger-text">
                      Wajib
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-[10px] leading-[14px] font-semibold",
                      GAYA_TINGKAT[k.tingkat],
                    )}
                  >
                    {LABEL_TINGKAT[k.tingkat]}
                  </span>
                </span>

                {kelola ? (
                  <TombolAktifKursus kursusId={k.id} aktif={k.aktif} />
                ) : null}
              </div>

              {k.terdaftar ? (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-card"
                    >
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          lulus ? "bg-ok" : "bg-secondary",
                        )}
                        style={{ width: `${kemajuan}%` }}
                      />
                    </span>
                    <span className="tabular shrink-0 text-[10px] leading-[14px] text-muted-foreground">
                      {jumlahTuntas(k)}/{k.modul.length} modul ·{" "}
                      {persen(kemajuan, 0)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[11px] leading-[14px] text-muted-foreground">
                  Belum diikuti.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
