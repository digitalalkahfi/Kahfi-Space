import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { KartuGoalKorporasi } from "@/components/grd/kartu-goal-korporasi";
import { KartuWrm } from "@/components/grd/kartu-wrm";
import { PapanLeadMeasure } from "@/components/grd/papan-lead-measure";
import { TanggaTarget } from "@/components/grd/anak-tangga";
import { NavigasiGrd } from "@/components/grd/navigasi-grd";
import { Reveal } from "@/components/motion/reveal";
import { ringkasanGrd } from "@/lib/data/grd";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";
import { tanggalPendek } from "@/lib/format";

export const metadata: Metadata = {
  title: "GRD — K-Space V2",
  description:
    "Goal, roll-down target, lead measure, dan matriks WRM dalam satu layar.",
};

/** Nomor pekan ISO — dipakai sebagai label periode. */
function pekanIso(tanggal: string) {
  const d = new Date(`${tanggal}T00:00:00Z`);
  const hari = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - hari + 3);
  const kamisPertama = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const selisih = (d.getTime() - kamisPertama.getTime()) / 86_400_000;
  return (
    1 + Math.round((selisih - 3 + ((kamisPertama.getUTCDay() + 6) % 7)) / 7)
  );
}

export default async function GrdPage({ searchParams }: PageProps<"/grd">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const { goal, wrm, papan, tangga } = await ringkasanGrd(pengguna, tanggal);

  return (
    <AppShell pengguna={pengguna} halaman="GRD">
      <div className="mx-auto w-full max-w-5xl space-y-4 lg:space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              GRD
            </h1>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              Goal, roll-down target, lead measure, dan matriks WRM.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="tabular rounded-full bg-primary px-3 py-1.5 text-[11px] leading-[14px] font-semibold text-primary-foreground">
              Minggu {pekanIso(tanggal)}
            </span>
            <span className="rounded-full bg-card px-3 py-1.5 text-[11px] leading-[14px] font-semibold text-muted-foreground ring-1 ring-border-subtle">
              {goal.periode || tanggalPendek(tanggal)}
            </span>
          </div>
        </div>

        <Reveal>
          <KartuGoalKorporasi goal={goal} />
        </Reveal>

        <Reveal>
          <KartuWrm wrm={wrm} />
        </Reveal>

        <Reveal>
          <NavigasiGrd />
        </Reveal>

        <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
          <Reveal>
            <Link href="/grd/lead-measure" className="block">
              <PapanLeadMeasure papan={papan} />
            </Link>
          </Reveal>
          <Reveal>
            <TanggaTarget tangga={tangga} />
          </Reveal>
        </div>
      </div>
    </AppShell>
  );
}
