import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Reveal } from "@/components/motion/reveal";
import { SubMenuAkun } from "@/components/profil/sub-menu-akun";
import {
  KartuAkun,
  KartuAturanSandi,
} from "@/components/profil/kartu-keamanan";
import { FormGantiSandi } from "@/components/profil/form-ganti-sandi";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Keamanan Akun — K-Space V2",
  description: "Cara akun ini diamankan dan aturan kata sandi.",
};

/**
 * Keamanan Akun (PRD Fase 1).
 *
 * Halaman ini menjawab dua hal sebelum orang menekan apa pun: akun kerja
 * ini terikat ke email yang mana, dan sandi seperti apa yang akan
 * diterima. Keduanya biasanya baru dicari justru ketika seseorang sudah
 * kehilangan akses — jadi lebih baik ada sebelum dibutuhkan.
 */
export default async function KeamananPage({
  searchParams,
}: PageProps<"/keamanan">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  return (
    <AppShell pengguna={pengguna} halaman="Keamanan akun">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            <ShieldCheck className="size-3.5" />
            Keamanan akun
          </p>
          <SubMenuAkun />
        </div>

        <Reveal>
          <KartuAkun email={pengguna.email} />
        </Reveal>

        <Reveal>
          <FormGantiSandi nama={pengguna.nama} email={pengguna.email} />
        </Reveal>

        <Reveal>
          <KartuAturanSandi nama={pengguna.nama} email={pengguna.email} />
        </Reveal>
      </div>
    </AppShell>
  );
}
