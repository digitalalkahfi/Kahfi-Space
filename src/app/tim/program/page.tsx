import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Reveal } from "@/components/motion/reveal";
import { CatatanDataContoh } from "@/components/shared/catatan-data-contoh";
import { KelolaProgram } from "@/components/tim/kelola-program";
import { bolehKelolaProgram, daftarProgram } from "@/lib/data/program";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Program — K-Space V2",
  description:
    "Program tiap unit beserta berapa anggota dan akun yang memakainya.",
};

/**
 * Pengelolaan program.
 *
 * Program selama ini hanya muncul sebagai pilihan di form anggota dan
 * akun — bisa dipakai, tapi tidak bisa ditambah tanpa menyentuh
 * database. Halaman ini menutup itu, dan sekaligus menunjukkan berapa
 * banyak yang benar-benar memakai tiap program: angka itulah yang
 * menentukan apakah sebuah program masih perlu ada.
 */
export default async function ProgramPage({
  searchParams,
}: PageProps<"/tim/program">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const daftar = await daftarProgram(pengguna);
  const aktif = daftar.filter((p) => p.aktif).length;

  return (
    <AppShell pengguna={pengguna} halaman="Anggota Tim">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/tim/struktur"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Struktur organisasi
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Program
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {aktif} program aktif dari {daftar.length} yang pernah dibuat.
            Program menentukan cara sebuah akun atau anggota dikelompokkan di
            luar unitnya.
          </p>
        </div>

        <CatatanDataContoh pesan="Mode demo: penambahan dan penonaktifan program diperiksa, tetapi tidak tersimpan." />

        <Reveal>
          <KelolaProgram
            daftar={daftar}
            bolehKelola={bolehKelolaProgram(pengguna)}
          />
        </Reveal>
      </div>
    </AppShell>
  );
}
