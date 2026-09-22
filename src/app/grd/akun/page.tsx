import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DaftarAkun } from "@/components/grd/daftar-akun";
import { DialogTambahAkun } from "@/components/grd/dialog-tambah-akun";
import { Reveal } from "@/components/motion/reveal";
import {
  bolehKelolaAkun,
  daftarAkun,
  kandidatCoLeader,
  kandidatPic,
  programUnit,
} from "@/lib/data/akun";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Kelola Akun — K-Space V2",
  description:
    "Akun affiliator beserta PIC yang bertanggung jawab atas laporan hariannya.",
};

export default async function AkunPage({
  searchParams,
}: PageProps<"/grd/akun">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const [daftar, kandidat, pendamping, program] = await Promise.all([
    daftarAkun(pengguna, `${tanggal.slice(0, 7)}-01`, tanggal),
    kandidatPic("affiliator"),
    kandidatCoLeader("affiliator"),
    programUnit("affiliator"),
  ]);

  const bolehKelola = bolehKelolaAkun(pengguna);

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

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Kelola akun
            </h1>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              Setiap akun affiliator dipegang satu PIC; dialah yang mengisi
              Laporan Harian akun itu.
            </p>
          </div>

          {bolehKelola ? (
            <DialogTambahAkun
              unitKode="affiliator"
              unitNama="Affiliator Network"
              program={program}
              kandidat={kandidat}
            />
          ) : null}
        </div>

        <Reveal>
          <DaftarAkun
            daftar={daftar}
            kandidat={kandidat}
            kandidatCoLeader={pendamping}
            bolehKelola={bolehKelola}
          />
        </Reveal>
      </div>
    </AppShell>
  );
}
