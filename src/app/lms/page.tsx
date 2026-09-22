import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import {
  DaftarKursus,
  RingkasanBelajar,
} from "@/components/lms/daftar-kursus";
import { Reveal } from "@/components/motion/reveal";
import { bolehKelolaKursus, daftarKursus } from "@/lib/data/lms";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { DialogTambahKursus } from "@/components/lms/dialog-kursus";
import Link from "next/link";
import { Users } from "lucide-react";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Pembelajaran — K-Space V2",
  description:
    "Kursus internal Al-Kahfi Corp beserta kemajuan belajar tiap orang.",
};

export default async function LmsPage({ searchParams }: PageProps<"/lms">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const bolehKelola = bolehKelolaKursus(pengguna);
  const [daftar, pilihan] = await Promise.all([
    daftarKursus(pengguna),
    bolehKelola ? pilihanOrganisasi() : Promise.resolve(null),
  ]);

  return (
    <AppShell pengguna={pengguna} halaman="Pembelajaran">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Pembelajaran
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Kemajuan dihitung dari modul yang benar-benar tuntas, bukan dari
              berapa kali kursusnya dibuka.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/lms/progres"
              className="tekan-halus sentuh-nyaman inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-4 text-[11px] leading-[18px] font-semibold ring-1 ring-border-subtle"
            >
              <Users className="size-3.5" />
              Progres tim
            </Link>
            {pilihan ? <DialogTambahKursus pilihan={pilihan} /> : null}
          </div>
        </div>

        <RingkasanBelajar daftar={daftar} peran={pengguna.role} />

        <Reveal>
          <DaftarKursus
            daftar={daftar}
            peran={pengguna.role}
            kelola={bolehKelola}
          />
        </Reveal>
      </div>
    </AppShell>
  );
}
