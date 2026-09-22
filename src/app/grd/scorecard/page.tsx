import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PanelKunciKpi } from "@/components/grd/panel-kunci-kpi";
import { PilihBulanKpi } from "@/components/grd/pilih-bulan-kpi";
import { Scorecard } from "@/components/grd/scorecard";
import { Reveal } from "@/components/motion/reveal";
import { scorecardTim, statusKunciKpi } from "@/lib/data/kpi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { bulanPanjang } from "@/lib/format";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Scorecard KPI — K-Space V2",
  description: "Skor dan predikat KPI tiap anggota tim pada skala 1.000.",
};

export default async function ScorecardPage({
  searchParams,
}: PageProps<"/grd/scorecard">) {
  const { persona, bulan: bulanParam } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);
  const bulanIni = `${tanggal.slice(0, 7)}-01`;

  // Bulan dari URL; yang tidak berbentuk atau di masa depan diabaikan.
  const bulan =
    typeof bulanParam === "string" &&
    /^\d{4}-\d{2}-01$/.test(bulanParam) &&
    bulanParam <= bulanIni
      ? bulanParam
      : bulanIni;

  // Bulan yang sudah lewat dihitung sampai hari terakhirnya, bukan sampai
  // hari ini — kalau tidak, capaiannya terpotong tanpa sebab.
  const akhirBulan = new Date(
    Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0),
  )
    .toISOString()
    .slice(0, 10);
  const sampai = bulan === bulanIni ? tanggal : akhirBulan;

  const [daftar, statusKunci] = await Promise.all([
    scorecardTim(pengguna, bulan, sampai),
    // Tuntas-tidaknya sebuah bulan diukur terhadap hari ini, bukan terhadap
    // batas hitung bulan yang sedang dilihat.
    statusKunciKpi(bulan, tanggal),
  ]);

  // Penguncian hanya urusan CEO/Manager; peran lain cukup melihat skornya.
  const bolehKunci = pengguna.role === "CEO" || pengguna.role === "Manager";

  const bulanLabel = bulanPanjang(bulan);

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

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Scorecard KPI
          </h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Dihitung otomatis dari GMV, lead measure, absensi, dan tugas — bukan
            dinilai manual.
          </p>
        </div>

        <PilihBulanKpi
          bulanAktif={bulan}
          bulanIni={bulanIni}
          persona={typeof persona === "string" ? persona : undefined}
        />

        {bolehKunci ? (
          <Reveal>
            <PanelKunciKpi
              status={statusKunci}
              bulan={bulan}
              bulanLabel={bulanLabel}
            />
          </Reveal>
        ) : null}

        <Reveal>
          <Scorecard daftar={daftar} bulanLabel={bulanLabel} />
        </Reveal>
      </div>
    </AppShell>
  );
}
