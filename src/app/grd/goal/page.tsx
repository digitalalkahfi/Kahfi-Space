import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PohonGoal } from "@/components/grd/pohon-goal";
import { TanggaBulanan } from "@/components/grd/tangga-bulanan";
import { Reveal } from "@/components/motion/reveal";
import { DialogTambahGoal } from "@/components/grd/dialog-tambah-goal";
import { periodeKuartal } from "@/lib/goal";
import {
  anakTanggaBulanan,
  bolehKelolaGoal,
  pilihanGoal,
  pohonGoal,
} from "@/lib/data/goal";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Goal & Roll-down — K-Space V2",
  description:
    "Goal perusahaan diturunkan bertahap ke Manager, Leader, lalu akun.",
};

export default async function GoalPage({
  searchParams,
}: PageProps<"/grd/goal">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const pohon = await pohonGoal(pengguna, tanggal);
  const kelola = bolehKelolaGoal(pengguna);
  const pilihan = kelola ? await pilihanGoal() : null;

  // Anak tangga ditampilkan untuk goal teratas yang terlihat pengguna ini.
  const utama = pohon[0];
  const bulan = utama ? await anakTanggaBulanan(utama.id, tanggal) : [];

  return (
    <AppShell pengguna={pengguna} halaman="GRD">
      <div className="mx-auto w-full max-w-4xl space-y-4">
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
              Goal &amp; roll-down
            </h1>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              Goal hanya dibuat CEO atau Manager; Leader mengubah dengan izin,
              dan setiap perubahan meninggalkan jejak.
            </p>
          </div>
          {pilihan ? (
            <DialogTambahGoal
              pilihan={pilihan}
              bulanMulai={`${tanggal.slice(0, 7)}-01`}
              periode={periodeKuartal(tanggal)}
            />
          ) : null}
        </div>

        {utama ? (
          <Reveal>
            <TanggaBulanan judul={utama.judul} bulan={bulan} />
          </Reveal>
        ) : null}

        <Reveal>
          <PohonGoal pohon={pohon} />
        </Reveal>
      </div>
    </AppShell>
  );
}
