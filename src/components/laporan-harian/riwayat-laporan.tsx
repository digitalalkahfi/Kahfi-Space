import Link from "next/link";
import { History, PencilLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GAYA_CAPAIAN, warnaCapaian } from "@/lib/capaian";
import { GAYA_MINIMUM, statusTerkirim } from "@/lib/batas-minimum";
import {
  bilangan,
  persen,
  rasioCapaian,
  rupiahPenuh,
  tanggalRelatif,
} from "@/lib/format";
import type { LaporanHarian } from "@/lib/types";

/** Riwayat laporan yang pernah dikirim, lengkap dengan penanda revisi. */
export function RiwayatLaporan({
  riwayat,
  hariIni,
}: {
  riwayat: LaporanHarian[];
  hariIni: string;
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-center justify-between gap-3 px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <History className="size-4 text-muted-foreground" />
          Riwayat laporan terakhir
        </h2>
        <Link
          href="/laporan-harian/riwayat"
          className="sentuh-nyaman shrink-0 text-[13px] leading-[18px] font-semibold text-secondary hover:underline"
        >
          Lihat semua
        </Link>
      </div>

      <ul className="space-y-2 px-5">
        {riwayat.slice(0, 3).map((r) => {
          const rasio = rasioCapaian(r.gmv, r.target);
          const warna = warnaCapaian(rasio, r.target > 0);
          const statusUpload = statusTerkirim(r.jumlahUpload, r.minimumUpload);
          return (
            <li
              key={r.id}
              className={cn(
                "baris-interaktif rounded-2xl p-3.5",
                warna === "hijau"
                  ? "bg-ok-fill/60"
                  : warna === "merah"
                    ? "bg-danger-fill/50"
                    : "bg-warn-fill/60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] leading-[18px] font-semibold">
                    {tanggalRelatif(r.tanggal, hariIni)} · {r.label}
                  </p>
                  <p className="tabular mt-0.5 text-sm leading-5 font-bold">
                    {rupiahPenuh(r.gmv)}
                  </p>
                </div>
                <span
                  className={cn(
                    "tabular shrink-0 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
                    warna
                      ? GAYA_CAPAIAN[warna].pil
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {r.target > 0 ? persen(rasio) : "—"}
                </span>
              </div>

              {/* Unggahan terhadap batas minimumnya ikut di sini: GMV
                  sudah tercapai bukan alasan unggahan boleh sepi, dan
                  dua angka itu memang dinilai terpisah. */}
              {statusUpload ? (
                <p
                  className={cn(
                    "tabular mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                    "text-[11px] leading-[14px] font-semibold",
                    GAYA_MINIMUM[statusUpload].pil,
                  )}
                >
                  {bilangan(r.jumlahUpload ?? 0)} /{" "}
                  {bilangan(r.minimumUpload ?? 0)} upload
                  <span className="sr-only">
                    —{" "}
                    {statusUpload === "terpenuhi"
                      ? "memenuhi batas minimum"
                      : "di bawah batas minimum"}
                  </span>
                </p>
              ) : null}

              <p className="mt-1.5 line-clamp-2 text-[11px] leading-[14px] text-muted-foreground">
                {r.catatan}
              </p>

              {r.jumlahRevisi > 0 ? (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] leading-[14px] font-semibold text-warn-text">
                  <PencilLine className="size-3" />
                  {r.jumlahRevisi} revisi tercatat
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
