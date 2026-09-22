import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { DefinisiKpiJabatan } from "@/components/grd/definisi-kpi";
import { LegendaPredikat } from "@/components/grd/lencana-predikat";
import { Reveal } from "@/components/motion/reveal";
import { DialogTambahIndikatorKpi } from "@/components/grd/dialog-tambah-indikator-kpi";
import { definisiKpi, kelompokkanPerJabatan } from "@/lib/data/kpi";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Definisi KPI — K-Space V2",
  description: "Indikator KPI tiap jabatan pada skala 1.000.",
};

export default async function KpiPage({ searchParams }: PageProps<"/grd/kpi">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  // CEO/Manager perlu melihat indikator nonaktif juga supaya bisa
  // menghidupkannya lagi; peran lain cukup yang sedang dinilai.
  const kelola = pengguna.role === "CEO" || pengguna.role === "Manager";
  const kelompok = kelompokkanPerJabatan(
    await definisiKpi({ termasukNonaktif: kelola }),
  );

  return (
    <AppShell pengguna={pengguna} halaman="GRD">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/grd"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          GRD
        </Link>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Definisi KPI
            </h1>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              Semua indikator memakai skala 1.000 supaya sebanding dengan
              target GRD.
            </p>
          </div>
          {kelola && kelompok.length > 0 ? (
            <DialogTambahIndikatorKpi
              jabatan={kelompok.map((k) => ({
                nama: k.jabatan,
                totalBobot: k.totalBobot,
              }))}
            />
          ) : null}
        </div>

        <Reveal>
          <Card className="rounded-3xl bg-primary text-primary-foreground shadow-overlay ring-0">
            <div className="space-y-1.5 px-5">
              <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] uppercase">
                Cara membaca skornya
              </p>
              <p className="text-[13px] leading-[18px] text-primary-foreground/80">
                Capai <strong>base</strong> → 500. Capai <strong>goal</strong> →
                800. Capai <strong>stretch</strong> → 1.000. Di antaranya
                dihitung lurus, jadi setiap langkah kecil tetap terasa.
              </p>
              <div className="space-y-1.5 pt-0.5">
                <p className="text-[11px] leading-[14px] text-primary-foreground/70">
                  Predikat mengikuti skor akhirnya:
                </p>
                <LegendaPredikat />
              </div>
            </div>
          </Card>
        </Reveal>

        {kelompok.length === 0 ? (
          <p className="rounded-2xl bg-card px-5 py-4 text-[13px] leading-[18px] text-muted-foreground ring-1 ring-border-subtle">
            Belum ada definisi KPI.
          </p>
        ) : (
          kelompok.map((k) => (
            <Reveal key={k.jabatan}>
              <DefinisiKpiJabatan {...k} kelola={kelola} />
            </Reveal>
          ))
        )}
      </div>
    </AppShell>
  );
}
