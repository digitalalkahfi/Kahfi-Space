import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { KartuWrm } from "@/components/grd/kartu-wrm";
import { MatriksWrm } from "@/components/grd/matriks-wrm";
import { PanelLaporanMingguan } from "@/components/grd/panel-laporan-mingguan";
import { TabelMingguan } from "@/components/grd/tabel-mingguan";
import { Reveal } from "@/components/motion/reveal";
import { laporanMingguan, ringkasanGrd, seninPekan } from "@/lib/data/grd";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Laporan Mingguan — K-Space V2",
  description: "Matriks WRM per pekan beserta penandaan merah beruntun.",
};

export default async function MingguanPage({
  searchParams,
}: PageProps<"/grd/mingguan">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const [{ wrm }, daftar] = await Promise.all([
    ringkasanGrd(pengguna, tanggal),
    laporanMingguan(pengguna, tanggal),
  ]);

  // Pekan lalu: pekan terakhir yang benar-benar sudah selesai.
  const pekanIni = seninPekan(tanggal);
  const senin = new Date(`${pekanIni}T00:00:00Z`);
  senin.setUTCDate(senin.getUTCDate() - 7);
  const pekanLalu = senin.toISOString().slice(0, 10);

  const bolehBentuk = pengguna.role === "CEO" || pengguna.role === "Manager";

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
            Laporan mingguan
          </h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Hasil (GMV) disilangkan dengan KRI (lead measure) — dua sumbu, satu
            keputusan.
          </p>
        </div>

        {bolehBentuk ? (
          <Reveal>
            <PanelLaporanMingguan
              pekan={pekanLalu}
              sudahAda={
                modeData() !== "demo" &&
                daftar.some((d) => d.periode === pekanLalu)
              }
            />
          </Reveal>
        ) : null}

        <Reveal>
          <MatriksWrm wrm={wrm} riwayat={daftar} />
        </Reveal>

        <Reveal>
          <KartuWrm wrm={wrm} />
        </Reveal>

        <Reveal>
          <TabelMingguan daftar={daftar} />
        </Reveal>
      </div>
    </AppShell>
  );
}
