import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { SaringRiwayat } from "@/components/sampel/saring-riwayat";
import { RiwayatScan } from "@/components/sampel/riwayat-scan";
import { TabelRiwayatSampel } from "@/components/sampel/tabel-riwayat-sampel";
import { Reveal } from "@/components/motion/reveal";
import { kodeAsing, riwayatScan, riwayatSemuaSampel } from "@/lib/data/sampel";
import {
  bacaSaringanRiwayat,
  bacaSaringanScan,
  saringRiwayat,
  saringScan,
} from "@/lib/saring-sampel";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Riwayat Sampel — K-Space V2",
  description:
    "Seluruh perpindahan sampel yang tercatat, dengan pencarian dan saringan.",
};

export default async function RiwayatSampelPage({
  searchParams,
}: PageProps<"/sampel/riwayat">) {
  const params = await searchParams;
  const pengguna = await sesiSaatIni(
    peranValid(params.persona) ? params.persona : undefined,
  );
  if (!pengguna) redirect("/masuk");

  const saringanScan = bacaSaringanScan(params);
  const [semua, scan, asing] = await Promise.all([
    riwayatSemuaSampel(pengguna),
    riwayatScan(saringanScan),
    kodeAsing(),
  ]);
  const scanTampil = saringScan(scan, saringanScan);
  const saringan = bacaSaringanRiwayat(params);
  const daftar = saringRiwayat(semua, saringan);

  // Pilihan unit dari daftar penuh, supaya menyaring satu unit tidak
  // membuat unit lain lenyap dari pilihannya.
  const unit = [...new Set(semua.map((b) => b.unitNama))].sort();

  return (
    <AppShell pengguna={pengguna} halaman="Sampel">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/sampel"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Sampel
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Riwayat perpindahan
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {semua.length} perpindahan tercatat. Inilah yang menjawab
            &ldquo;sejak kapan barang ini di sana&rdquo; dan siapa yang
            terakhir memegangnya.
          </p>
        </div>

        <SaringRiwayat
          saringan={saringan}
          unit={unit}
          jumlah={daftar.length}
          total={semua.length}
        />

        <Reveal>
          <TabelRiwayatSampel daftar={daftar} />
        </Reveal>

        {scan.length > 0 || asing.length > 0 ? (
          <Reveal>
            <RiwayatScan
              daftar={scanTampil}
              asing={asing}
              saringan={saringanScan}
              total={scan.length}
            />
          </Reveal>
        ) : null}
      </div>
    </AppShell>
  );
}
