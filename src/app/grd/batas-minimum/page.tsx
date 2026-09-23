import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Reveal } from "@/components/motion/reveal";
import { TabelBatasMinimum } from "@/components/grd/tabel-batas-minimum";
import { sebaranLevel } from "@/lib/data/kepatuhan";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Batas Minimum Upload — K-Space V2",
  description:
    "Acuan batas minimum unggahan per hari kerja untuk tiap level akun.",
};

/**
 * Halaman acuan batas minimum per level.
 *
 * Angkanya sudah dipakai di banyak layar, tapi selama ini tidak ada satu
 * tempat pun yang menampilkan seluruh tangganya sekaligus — sehingga
 * "kenapa akun ini minimumnya 12" hanya bisa dijawab dengan membuka
 * migrasi. Halaman ini menjawabnya.
 */
export default async function BatasMinimumPage({
  searchParams,
}: PageProps<"/grd/batas-minimum">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  // Hanya akun aktif yang dicacah: akun nonaktif tidak lagi melapor,
  // jadi mengubah levelnya tidak berakibat apa pun hari ini.
  const baris = await sebaranLevel();

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
            Batas minimum upload
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Tiap akun punya level 0–8, dan levelnya menentukan berapa unggahan
            minimum yang diharapkan tiap hari kerja. Hari libur dan izin yang
            disetujui tidak ikut dihitung.
          </p>
        </div>

        <Reveal>
          <TabelBatasMinimum baris={baris} />
        </Reveal>
      </div>
    </AppShell>
  );
}
