import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import {
  DaftarMasukan,
  RingkasanMasukan,
} from "@/components/masukan/daftar-masukan";
import { Reveal } from "@/components/motion/reveal";
import { daftarMasukan } from "@/lib/data/masukan";
import { SaringMasukan } from "@/components/masukan/saring-masukan";
import { bacaSaringanMasukan, saringMasukan } from "@/lib/masukan";
import { DialogKirimMasukan } from "@/components/masukan/dialog-masukan";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Masukan & Bug — K-Space V2",
  description:
    "Saran, pertanyaan, dan laporan bug dari seluruh anggota tim beserta tindak lanjutnya.",
};

export default async function MasukanPage({
  searchParams,
}: PageProps<"/masukan">) {
  const params = await searchParams;
  const pengguna = await sesiSaatIni(
    peranValid(params.persona) ? params.persona : undefined,
  );
  if (!pengguna) redirect("/masuk");

  const semua = await daftarMasukan(pengguna);
  const saringan = bacaSaringanMasukan(params);
  const daftar = saringMasukan(semua, saringan);
  const acuan =
    modeData() === "demo"
      ? `${TANGGAL_ACUAN}T12:00:00+07:00`
      : new Date().toISOString();

  return (
    <AppShell pengguna={pengguna} halaman="Masukan">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Masukan &amp; bug
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Semua orang melihat semua masukan — supaya hal yang sama tidak
              dilaporkan berulang kali, dan pelapor tahu keluhannya sampai.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/masukan/saya"
              className="tekan-halus sentuh-nyaman inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-4 text-[11px] leading-[18px] font-semibold ring-1 ring-border-subtle"
            >
              <Inbox className="size-3.5" />
              Kiriman saya
            </Link>
            <DialogKirimMasukan terbuka={semua} />
          </div>
        </div>

        <RingkasanMasukan daftar={semua} />

        <SaringMasukan
          saringan={saringan}
          jumlah={daftar.length}
          total={semua.length}
        />

        <Reveal>
          <DaftarMasukan daftar={daftar} acuan={acuan} />
        </Reveal>
      </div>
    </AppShell>
  );
}
