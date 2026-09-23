import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { FormIzin } from "@/components/absensi/form-izin";
import { DaftarPengajuan } from "@/components/absensi/daftar-pengajuan";
import { RiwayatIzin } from "@/components/absensi/riwayat-izin";
import { Reveal } from "@/components/motion/reveal";
import { izinSaya, pengajuanMenunggu } from "@/lib/data/absensi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Izin & Sakit — K-Space V2",
  description: "Ajukan izin atau sakit dengan persetujuan atasan.",
};

/** Peran yang menerima antrean persetujuan. */
const PEMUTUS = ["CEO", "Manager", "Leader", "Co-Leader"];

export default async function IzinPage({
  searchParams,
}: PageProps<"/absensi/izin">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const acuan =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  // Riwayat dibatasi 60 hari ke belakang: yang berguna adalah keputusan
  // yang masih bisa ditindaklanjuti, bukan arsip tahun lalu.
  const sejak = new Date(`${acuan}T00:00:00Z`);
  sejak.setUTCDate(sejak.getUTCDate() - 60);

  const [pengajuan, milikku] = await Promise.all([
    PEMUTUS.includes(pengguna.role)
      ? pengajuanMenunggu(pengguna)
      : Promise.resolve([]),
    izinSaya(pengguna, sejak.toISOString().slice(0, 10)),
  ]);

  return (
    <AppShell pengguna={pengguna} halaman="Absensi">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/absensi"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Absensi
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Izin &amp; Sakit
          </h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Pengajuan tercatat di rekap kehadiran setelah disetujui atasan.
          </p>
        </div>

        {PEMUTUS.includes(pengguna.role) ? (
          <Reveal>
            <DaftarPengajuan pengajuan={pengajuan} />
          </Reveal>
        ) : null}

        <Reveal>
          <FormIzin hariIni={acuan} />
        </Reveal>

        <Reveal>
          <RiwayatIzin daftar={milikku} />
        </Reveal>
      </div>
    </AppShell>
  );
}
