import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Reveal } from "@/components/motion/reveal";
import { SubMenuNotifikasi } from "@/components/notifikasi/sub-menu-notifikasi";
import { SaklarPreferensi } from "@/components/notifikasi/saklar-preferensi";
import { preferensiSaya } from "@/lib/data/preferensi-notifikasi";
import { profilSaya } from "@/lib/data/profil";
import { formatKontak } from "@/lib/profil";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Preferensi Notifikasi — K-Space V2",
  description: "Atur kategori mana yang muncul dan lewat kanal apa.",
};

/**
 * Preferensi notifikasi (PRD Fase 3).
 *
 * Yang diatur di sini bukan "mau diganggu atau tidak", melainkan lewat
 * kanal apa sebuah kategori sampai. Karena itu peran yang menerima
 * tugas — Staff, Leader, Co-Leader, Finance — tidak bisa mematikan
 * kanal in-app: notifikasi mereka berisi pekerjaan yang ditujukan
 * kepada mereka.
 */
export default async function PreferensiNotifikasiPage({
  searchParams,
}: PageProps<"/notifikasi/preferensi">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const [preferensi, profil] = await Promise.all([
    preferensiSaya(pengguna),
    profilSaya(pengguna),
  ]);
  const kontak = formatKontak(profil?.kontak ?? null);

  return (
    <AppShell pengguna={pengguna} halaman="Preferensi notifikasi">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="space-y-2">
          <div>
            <h1 className="flex items-center gap-2 text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              <SlidersHorizontal className="size-5 shrink-0 text-muted-foreground" />
              Preferensi notifikasi
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Pilih kategori mana yang sampai kepadamu, dan lewat kanal apa.
              Perubahan berlaku untuk notifikasi berikutnya — yang sudah terbit
              tetap ada di daftarmu.
            </p>
          </div>

          <SubMenuNotifikasi />
        </div>

        <Reveal>
          <SaklarPreferensi
            awal={preferensi}
            peran={pengguna.role}
            kontak={kontak}
          />
        </Reveal>
      </div>
    </AppShell>
  );
}
