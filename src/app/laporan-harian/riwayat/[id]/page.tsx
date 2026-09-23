import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft, History } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  bilangan,
  jamWib,
  persen,
  rasioCapaian,
  rupiahPenuh,
  rupiahRingkas,
  tanggalPanjang,
} from "@/lib/format";
import { LABEL_KOLOM } from "@/lib/laporan";
import { GAYA_CAPAIAN, warnaCapaian } from "@/lib/capaian";
import { RincianRevisi } from "@/components/laporan-harian/rincian-revisi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { ambilLaporan } from "@/lib/data/laporan";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Detail Laporan — K-Space V2",
  description: "Rincian satu laporan harian beserta jejak perbaikannya.",
};

export default async function DetailLaporanPage({
  params,
  searchParams,
}: PageProps<"/laporan-harian/riwayat/[id]">) {
  const { id } = await params;
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const hasil = await ambilLaporan(decodeURIComponent(id), pengguna, tanggal);
  if (!hasil) notFound();

  const { laporan, jejak } = hasil;
  const rasio = rasioCapaian(laporan.gmv, laporan.target);
  const warna = warnaCapaian(rasio, laporan.target > 0);

  const tambahan = [
    laporan.komisi !== null
      ? { label: LABEL_KOLOM.komisi, nilai: rupiahPenuh(laporan.komisi) }
      : null,
    laporan.jumlahUpload !== null
      ? {
          label: LABEL_KOLOM.jumlahUpload,
          // Batas minimumnya ikut di sini, bukan sebagai baris terpisah:
          // angka unggahan tidak berarti apa-apa tanpa pembandingnya.
          nilai:
            laporan.minimumUpload === null
              ? bilangan(laporan.jumlahUpload)
              : `${bilangan(laporan.jumlahUpload)} / ${bilangan(laporan.minimumUpload)} min.`,
        }
      : null,
    laporan.coSampel !== null
      ? { label: LABEL_KOLOM.coSampel, nilai: bilangan(laporan.coSampel) }
      : null,
  ].filter((t) => t !== null);

  return (
    <AppShell pengguna={pengguna} halaman="Laporan Harian">
      <article className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/laporan-harian/riwayat"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Riwayat laporan
        </Link>

        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <div className="space-y-4 px-5">
            <div>
              <p className="text-[13px] leading-[18px] text-muted-foreground">
                {tanggalPanjang(laporan.tanggal)} · dikirim{" "}
                {jamWib(laporan.submittedAt)}
              </p>
              <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
                {laporan.label}
              </h1>
            </div>

            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="text-[11px] leading-[14px] text-muted-foreground">
                  GMV tercatat
                </p>
                <p className="tabular text-2xl leading-[30px] font-bold tracking-tight">
                  {rupiahPenuh(laporan.gmv)}
                </p>
              </div>
              <div>
                <p className="text-[11px] leading-[14px] text-muted-foreground">
                  Target harian
                </p>
                <p className="tabular text-base leading-6 font-semibold text-muted-foreground">
                  {rupiahRingkas(laporan.target)}
                </p>
              </div>
              <span
                className={cn(
                  "tabular rounded-full px-3 py-1 text-[13px] leading-[18px] font-semibold",
                  warna
                    ? GAYA_CAPAIAN[warna].pil
                    : "bg-muted text-muted-foreground",
                )}
              >
                {laporan.target > 0
                  ? `${persen(rasio)} dari target`
                  : "Target belum ada di GRD"}
              </span>
            </div>

            {/* Kolom departemen hanya muncul bila memang dilaporkan —
                menampilkan "Komisi Rp 0" untuk MCN & TAP akan terbaca
                sebagai komisi nol, bukan sebagai tidak berlaku. */}
            {tambahan.length > 0 ? (
              <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border-subtle pt-4">
                {tambahan.map((t) => (
                  <div key={t.label}>
                    <dt className="text-[11px] leading-[14px] text-muted-foreground">
                      {t.label}
                    </dt>
                    <dd className="tabular text-base leading-6 font-semibold">
                      {t.nilai}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {laporan.catatan ? (
              <div className="border-t border-border-subtle pt-4">
                <p className="text-[11px] leading-[14px] font-semibold text-muted-foreground">
                  Catatan harian
                </p>
                <p className="mt-1 text-[15px] leading-[22px] text-pretty">
                  {laporan.catatan}
                </p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <div className="px-5">
            <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
              <History className="size-4 text-muted-foreground" />
              Jejak perbaikan ({jejak.length})
            </h2>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              Setiap angka yang berubah tercatat lengkap dan tidak bisa dihapus.
            </p>
          </div>

          {jejak.length === 0 ? (
            <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
              Belum pernah diperbaiki sejak dikirim.
            </p>
          ) : (
            <ol className="space-y-2 px-5">
              {jejak.map((r) => (
                <li key={r.id} className="rounded-2xl bg-muted/60 p-3.5">
                  <RincianRevisi revisi={r} />
                  <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
                    {r.alasan}
                  </p>
                  <p className="mt-1 text-[11px] leading-[14px] text-muted-foreground">
                    {r.diubahOleh} · {tanggalPanjang(r.createdAt)}{" "}
                    {jamWib(r.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </article>
    </AppShell>
  );
}
