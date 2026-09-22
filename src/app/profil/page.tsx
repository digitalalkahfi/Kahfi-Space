import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { KeadaanKosong } from "@/components/shared/keadaan";
import {
  DataKepegawaian,
  KepalaProfilDiri,
} from "@/components/profil/kartu-profil";
import { KartuKontak } from "@/components/profil/kartu-kontak";
import { SubMenuAkun } from "@/components/profil/sub-menu-akun";
import { profilSaya } from "@/lib/data/profil";
import { kelengkapanProfil, kesiapanWhatsapp } from "@/lib/profil";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Profil Saya — K-Space V2",
  description:
    "Data diri, kontak, dan data kepegawaian yang ditetapkan pengelola.",
};

/**
 * Profil Saya (PRD Fase 1).
 *
 * Halaman ini menjawab dua pertanyaan sekaligus: "apa yang sistem tahu
 * tentang saya" dan "mana yang bisa saya perbaiki sendiri". Keduanya
 * dijawab di layar yang sama supaya orang tidak menebak — selama ini
 * perubahan sekecil salah ketik nama harus lewat pengelola karena tidak
 * ada tempat untuk melihatnya.
 *
 * Keempat keadaan modul ada di tempatnya masing-masing: memuat dan gagal
 * di batas rute (loading.tsx & error.tsx), kosong di halaman ini saat
 * akun Auth belum punya baris kepegawaian.
 */
export default async function ProfilPage({
  searchParams,
}: PageProps<"/profil">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const profil = await profilSaya(pengguna);

  return (
    <AppShell pengguna={pengguna} halaman="Profil saya">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            <UserRound className="size-3.5" />
            Profil saya
          </p>
          <SubMenuAkun />
        </div>

        {profil === null ? (
          <KeadaanKosong
            ikon={<UserRound className="size-4" />}
            judul="Akun ini belum punya profil kepegawaian"
            pesan="Akunmu bisa masuk, tapi belum tercatat di daftar anggota — jadi belum ada peran, unit, maupun atasan yang melekat padanya. Pengelola yang melengkapinya."
            aksi={
              <Link
                href="/masukan"
                className="tekan-halus sentuh-nyaman inline-flex h-9 items-center rounded-full bg-primary px-4 text-[11px] leading-[14px] font-semibold text-primary-foreground"
              >
                Laporkan ke pengelola
              </Link>
            }
          />
        ) : (
          <IsiProfil profil={profil} />
        )}
      </div>
    </AppShell>
  );
}

function IsiProfil({
  profil,
}: {
  profil: NonNullable<Awaited<ReturnType<typeof profilSaya>>>;
}) {
  const { lengkap, kurang } = kelengkapanProfil(profil);

  return (
    <>
      <Reveal>
        <KepalaProfilDiri profil={profil} />
      </Reveal>

      {lengkap ? null : (
        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Belum terisi: {kurang.join(" dan ")}. Nomor kontak baru benar-benar
            berguna setelah kanal WhatsApp menyala, tapi mengisinya sekarang
            membuatnya siap sejak hari pertama.
          </p>
        </Card>
      )}

      <Reveal>
        <KartuKontak
          kontakAwal={profil.kontak}
          kesiapan={kesiapanWhatsapp(profil)}
          optin={profil.whatsappOptin}
        />
      </Reveal>

      <Reveal>
        <DataKepegawaian profil={profil} />
      </Reveal>
    </>
  );
}
