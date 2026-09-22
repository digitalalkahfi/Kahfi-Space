import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { TabelRiwayat } from "@/components/laporan-harian/tabel-riwayat";

import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { riwayatLaporan } from "@/lib/data/laporan";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Riwayat Laporan — K-Space V2",
  description: "Telusuri laporan harian yang sudah dikirim beserta angkanya.",
};

export default async function RiwayatPage({
  searchParams,
}: PageProps<"/laporan-harian/riwayat">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);
  const riwayat = await riwayatLaporan(pengguna, tanggal, 120);

  return (
    <AppShell pengguna={pengguna} halaman="Laporan Harian">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Link
          href="/laporan-harian"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Laporan Harian
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Riwayat Laporan
          </h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Laporan yang sudah pernah dikirim beserta angkanya.
          </p>
        </div>

        <TabelRiwayat riwayat={riwayat} olehNama={pengguna.nama} />
      </div>
    </AppShell>
  );
}
