import Link from "next/link";
import { CircleAlert, Lightbulb, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalRelatif } from "@/lib/format";
import {
  GAYA_DAMPAK,
  GAYA_STATUS_MASALAH,
  LABEL_DAMPAK,
  LABEL_STATUS_MASALAH,
  ringkasMasalah,
  type Masalah,
} from "@/lib/masalah";

/** Angka yang menyoroti mana yang mandek, bukan sekadar berapa banyak. */
export function RingkasanMasalah({ daftar }: { daftar: Masalah[] }) {
  const r = ringkasMasalah(daftar);

  const kotak = [
    {
      label: "Belum diterima",
      nilai: r.belumDiterima,
      keterangan: "dilaporkan, belum disentuh manajemen",
      bahaya: r.belumDiterima > 0,
    },
    {
      label: "Diproses",
      nilai: r.diproses,
      keterangan: "diterima, solusinya belum ditulis",
      bahaya: false,
    },
    {
      label: "Selesai",
      nilai: r.selesai,
      keterangan: "solusinya tercatat",
      bahaya: false,
    },
  ];

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <Search className="size-4 text-muted-foreground" />
          Yang perlu diperhatikan
        </h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          {r.total} masalah tercatat
        </p>
      </div>

      <dl className="tabular grid grid-cols-3 gap-2 px-5">
        {kotak.map((k) => (
          <div
            key={k.label}
            className={cn(
              "rounded-2xl p-3",
              k.bahaya ? "bg-warn-fill" : "bg-muted/50",
            )}
          >
            <dt
              className={cn(
                "text-[11px] leading-[14px]",
                k.bahaya ? "text-warn-text" : "text-muted-foreground",
              )}
            >
              {k.label}
            </dt>
            <dd
              className={cn(
                "text-lg leading-6 font-bold tracking-tight",
                k.bahaya && "text-warn-text",
              )}
            >
              {k.nilai}
            </dd>
            <dd
              className={cn(
                "text-[10px] leading-[14px] text-pretty",
                k.bahaya ? "text-warn-text" : "text-muted-foreground",
              )}
            >
              {k.keterangan}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Daftar laporan beserta solusinya bila sudah ada. */
export function DaftarMasalah({
  daftar,
  acuan,
}: {
  daftar: Masalah[];
  acuan: string;
}) {
  if (daftar.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada masalah yang tercatat untuk cakupanmu.
        </p>
      </Card>
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <h2 className="px-5 text-base leading-6 font-semibold">Daftar masalah</h2>

      <ul className="space-y-2 px-5">
        {daftar.map((m) => {
          const gaya = GAYA_STATUS_MASALAH[m.status];

          return (
            <li key={m.id} className="rounded-2xl bg-muted/50 p-3.5">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-card text-muted-foreground">
                  <CircleAlert className="size-4" />
                </span>

                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm leading-5 font-semibold text-pretty">
                    <Link href={`/masalah/${m.id}`} className="hover:underline">
                      {m.judul}
                    </Link>
                  </p>
                  <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
                    {m.unitNama}
                    {m.pelaporNama ? ` · ${m.pelaporNama}` : ""} ·{" "}
                    {tanggalRelatif(m.dibuatPada, acuan)}
                  </p>
                </div>

                <span className="flex h-fit shrink-0 flex-wrap gap-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                      gaya.kelas,
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", gaya.titik)} />
                    {LABEL_STATUS_MASALAH[m.status]}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-[10px] leading-[14px] font-semibold",
                      GAYA_DAMPAK[m.dampak],
                    )}
                  >
                    {LABEL_DAMPAK[m.dampak]}
                  </span>
                </span>
              </div>

              {/* Solusinya terbaca sekilas: itu yang dicari orang yang
                  membuka daftar ini, bukan judul masalahnya lagi. */}
              {m.solusi ? (
                <p className="mt-2 flex gap-1.5 text-[11px] leading-[14px] text-pretty">
                  <Lightbulb className="mt-px size-3 shrink-0 text-ok" />
                  <span className="line-clamp-2">{m.solusi}</span>
                </p>
              ) : (
                <p className="mt-2 text-[11px] leading-[14px] text-muted-foreground">
                  {m.status === "ditutup"
                    ? m.ditutupAlasan || "Ditutup tanpa alasan tercatat."
                    : "Solusi belum ditulis."}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
