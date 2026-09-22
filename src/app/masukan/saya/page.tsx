import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { KirimanSaya } from "@/components/masukan/kiriman-saya";
import { Reveal } from "@/components/motion/reveal";
import { daftarMasukan } from "@/lib/data/masukan";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Kiriman Saya — K-Space V2",
  description: "Masukan dan laporan bug yang kamu kirim beserta tindak lanjutnya.",
};

export default async function KirimanSayaPage({
  searchParams,
}: PageProps<"/masukan/saya">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const semua = await daftarMasukan(pengguna);
  const daftar = semua
    .filter((m) => m.pelaporNama === pengguna.nama)
    .sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada));

  const acuan =
    modeData() === "demo"
      ? `${TANGGAL_ACUAN}T12:00:00+07:00`
      : new Date().toISOString();

  return (
    <AppShell pengguna={pengguna} halaman="Masukan">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/masukan"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Masukan &amp; bug
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Kiriman saya
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Apa yang terjadi pada yang kamu laporkan — termasuk alasannya bila
            tidak dikerjakan.
          </p>
        </div>

        <Reveal>
          <KirimanSaya daftar={daftar} acuan={acuan} />
        </Reveal>
      </div>
    </AppShell>
  );
}
