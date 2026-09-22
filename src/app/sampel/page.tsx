import type { Metadata } from "next";
import Link from "next/link";
import { History, ScanLine } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import {
  DaftarSampel,
  RingkasanSampel,
} from "@/components/sampel/daftar-sampel";
import { TabInventaris } from "@/components/shared/tab-inventaris";
import { Reveal } from "@/components/motion/reveal";
import {
  bolehKelolaSampel,
  daftarSampel,
  kodeSampelBerikutnya,
} from "@/lib/data/sampel";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { DialogTambahSampel } from "@/components/sampel/dialog-sampel";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Sampel Produk — K-Space V2",
  description:
    "Sampel produk beserta keadaan dan pemegangnya, dilacak lewat kode QR.",
};

export default async function SampelPage({
  searchParams,
}: PageProps<"/sampel">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const [daftar, pilihan, kodeBerikutnya] = await Promise.all([
    daftarSampel(pengguna),
    pilihanOrganisasi(),
    kodeSampelBerikutnya(),
  ]);
  const bolehKelola = bolehKelolaSampel(pengguna);
  const acuan =
    modeData() === "demo"
      ? `${TANGGAL_ACUAN}T12:00:00+07:00`
      : new Date().toISOString();

  return (
    <AppShell pengguna={pengguna} halaman="Sampel">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Sampel produk
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Setiap sampel punya kode QR. Yang dicatat bukan hanya keadaannya
              sekarang, tapi setiap kali ia berpindah tangan.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/sampel/riwayat"
              className="tekan-halus sentuh-nyaman inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-4 text-[11px] leading-[18px] font-semibold ring-1 ring-border-subtle"
            >
              <History className="size-3.5" />
              Riwayat
            </Link>
            <Link
              href="/sampel/scan"
              className="tekan-halus sentuh-nyaman inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-4 text-[11px] leading-[18px] font-semibold ring-1 ring-border-subtle"
            >
              <ScanLine className="size-3.5" />
              Pindai
            </Link>
            {bolehKelola ? (
              <DialogTambahSampel
                pilihan={pilihan}
                kodeBerikutnya={kodeBerikutnya}
              />
            ) : null}
          </div>
        </div>

        <TabInventaris />

        <RingkasanSampel daftar={daftar} acuan={acuan} />

        <Reveal>
          <DaftarSampel
            daftar={daftar}
            acuan={acuan}
            pilihan={pilihan}
            bolehKelola={bolehKelola}
          />
        </Reveal>
      </div>
    </AppShell>
  );
}
