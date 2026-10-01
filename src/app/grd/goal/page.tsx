import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft, ListTree, Table2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PohonGoal } from "@/components/grd/pohon-goal";
import { TanggaBulanan } from "@/components/grd/tangga-bulanan";
import { Reveal } from "@/components/motion/reveal";
import { DialogTambahGoal } from "@/components/grd/dialog-tambah-goal";
import { TabelGrd } from "@/components/grd/tabel-grd";
import { tabelGrd } from "@/lib/data/tabel-grd";
import { cn } from "@/lib/utils";
import {
  anakTanggaBulanan,
  bolehKelolaGoal,
  pilihanGoal,
  pohonGoal,
} from "@/lib/data/goal";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";
import { hariIniWib } from "@/lib/format";

export const metadata: Metadata = {
  title: "Goal & Roll-down — K-Space V2",
  description:
    "Goal perusahaan diturunkan bertahap ke Manager, Leader, lalu akun.",
};

export default async function GoalPage({
  searchParams,
}: PageProps<"/grd/goal">) {
  const { persona, tampilan } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const tanggal = modeData() === "demo" ? TANGGAL_ACUAN : hariIniWib();
  const modeTabel = tampilan === "tabel";

  const kelola = bolehKelolaGoal(pengguna);
  const pilihan = kelola ? await pilihanGoal() : null;

  // Kedua tampilan membaca data yang sama (goals, grd_rencana); hanya
  // yang ditampilkan saja yang dimuat.
  const pohon = modeTabel ? [] : await pohonGoal(pengguna, tanggal);
  const tabel = modeTabel
    ? await tabelGrd(pengguna, `${tanggal.slice(0, 7)}-01`)
    : null;

  // Anak tangga ditampilkan untuk goal teratas yang terlihat pengguna ini.
  const utama = pohon[0];
  const bulan = utama ? await anakTanggaBulanan(utama.id, tanggal) : [];

  const alamat = (t: "hierarki" | "tabel") => {
    const q = new URLSearchParams();
    if (t === "tabel") q.set("tampilan", "tabel");
    if (typeof persona === "string") q.set("persona", persona);
    const s = q.toString();
    return s ? `/grd/goal?${s}` : "/grd/goal";
  };
  const PILIHAN_TAMPILAN = [
    {
      kunci: "hierarki" as const,
      label: "Hierarki / Roll-down",
      Ikon: ListTree,
    },
    { kunci: "tabel" as const, label: "Tabel GRD", Ikon: Table2 },
  ];

  return (
    <AppShell pengguna={pengguna} halaman="GRD">
      <div
        className={cn(
          "mx-auto w-full space-y-4",
          modeTabel ? "max-w-[1440px]" : "max-w-4xl",
        )}
      >
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
            <DialogTambahGoal pilihan={pilihan} acuan={tanggal} />
          ) : null}
        </div>

        <nav
          aria-label="Pilih tampilan goal"
          className="inline-flex rounded-full bg-muted p-1"
        >
          {PILIHAN_TAMPILAN.map(({ kunci, label, Ikon }) => {
            const aktif = (kunci === "tabel") === modeTabel;
            return (
              <Link
                key={kunci}
                href={alamat(kunci)}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "tekan-halus inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] leading-[18px] font-semibold",
                  aktif
                    ? "bg-card text-foreground shadow-card ring-1 ring-border-subtle"
                    : "text-muted-foreground",
                )}
              >
                <Ikon className="size-3.5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        {tabel ? (
          <Reveal>
            <TabelGrd tabel={tabel} hariIni={tanggal} />
          </Reveal>
        ) : (
          <>
            {utama ? (
              <Reveal>
                <TanggaBulanan judul={utama.judul} bulan={bulan} />
              </Reveal>
            ) : null}

            <Reveal>
              <PohonGoal pohon={pohon} acuan={tanggal} pilihan={pilihan} />
            </Reveal>
          </>
        )}
      </div>
    </AppShell>
  );
}
