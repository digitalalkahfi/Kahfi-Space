import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AksesDitolak } from "@/components/layout/akses-ditolak";
import { DaftarOrangPending } from "@/components/migrasi/daftar-orang-pending";
import { PanelTautanOrang } from "@/components/migrasi/panel-tautan-orang";
import { Reveal } from "@/components/motion/reveal";
import { bolehMigrasi, calonPadanan, orangPending } from "@/lib/data/migrasi";
import { tautanOrang } from "@/lib/data/resolusi";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Relasi Orang — K-Space V2",
  description:
    "Menautkan orang di data K-Space lama ke profil V2 sebelum datanya diproses.",
};

export default async function RelasiOrangPage({
  searchParams,
}: PageProps<"/migrasi/orang">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");
  if (!bolehMigrasi(pengguna)) {
    return (
      <AksesDitolak
        pengguna={pengguna}
        halaman="Relasi Orang"
        siapa="CEO dan Manager"
      />
    );
  }

  const [daftar, calon, tautan] = await Promise.all([
    orangPending(),
    calonPadanan(),
    tautanOrang(),
  ]);

  return (
    <AppShell pengguna={pengguna} halaman="Migrasi Data">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/migrasi/pemetaan"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Pemetaan
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Relasi orang
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Hampir seluruh data lama menunjuk orang: laporan punya pelapor,
            tugas punya penerima, transaksi punya pengaju. Id lamanya tidak
            berarti apa-apa di V2 sampai ada yang menautkannya.
          </p>
        </div>

        {modeData() === "demo" ? (
          <p className="rounded-3xl bg-muted px-5 py-4 text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Mode demo membaca contoh ekspor di repositori, dan keputusannya
            tidak tersimpan ke mana pun. Yang terlihat di sini adalah bentuk
            layarnya, bukan keadaan sistem lama yang sebenarnya.
          </p>
        ) : null}

        <Reveal>
          <DaftarOrangPending daftar={daftar} calon={calon} />
        </Reveal>

        <Reveal>
          <PanelTautanOrang daftar={tautan} />
        </Reveal>
      </div>
    </AppShell>
  );
}
