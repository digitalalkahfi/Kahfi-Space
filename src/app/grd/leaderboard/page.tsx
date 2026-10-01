import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PapanAkun, PapanKpi } from "@/components/grd/papan-peringkat";
import { PilihBulanKpi } from "@/components/grd/pilih-bulan-kpi";
import { Reveal } from "@/components/motion/reveal";
import { papanAkun, papanKpi } from "@/lib/data/papan";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";
import { bulanPanjang, hariIniWib } from "@/lib/format";

export const metadata: Metadata = {
  title: "Leaderboard — K-Space V2",
  description:
    "Peringkat NILAI KPI per level dan papan akun menurut capaian target GMV.",
};

export default async function LeaderboardPage({
  searchParams,
}: PageProps<"/grd/leaderboard">) {
  const { persona, bulan: bulanParam } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const tanggal = modeData() === "demo" ? TANGGAL_ACUAN : hariIniWib();
  const bulanIni = `${tanggal.slice(0, 7)}-01`;
  const bulan =
    typeof bulanParam === "string" &&
    /^\d{4}-\d{2}-01$/.test(bulanParam) &&
    bulanParam <= bulanIni
      ? bulanParam
      : bulanIni;
  // Sama dengan scorecard: bulan lalu dihitung sampai hari terakhirnya.
  const akhirBulan = new Date(
    Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0),
  )
    .toISOString()
    .slice(0, 10);
  const sampai = bulan === bulanIni ? tanggal : akhirBulan;

  const [orang, akun] = await Promise.all([
    papanKpi(pengguna, bulan, sampai),
    papanAkun(pengguna, bulan, sampai),
  ]);

  return (
    <AppShell pengguna={pengguna} halaman="GRD">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Link
          href="/grd"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          GRD
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Leaderboard
          </h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {bulanPanjang(bulan)} · NILAI KPI yang sama dengan scorecard,
            diperingkat per level.
            {bulan === bulanIni
              ? " Bulan berjalan: target GMV diprorata sampai hari ini."
              : ""}
          </p>
        </div>

        <PilihBulanKpi
          bulanAktif={bulan}
          bulanIni={bulanIni}
          persona={typeof persona === "string" ? persona : undefined}
          alamat="/grd/leaderboard"
        />

        <Reveal>
          <PapanKpi daftar={orang} penggunaId={pengguna.id} />
        </Reveal>

        <Reveal>
          <PapanAkun daftar={akun} />
        </Reveal>
      </div>
    </AppShell>
  );
}
