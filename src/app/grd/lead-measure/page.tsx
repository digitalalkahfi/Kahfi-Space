import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EntriLeadMeasure } from "@/components/grd/entri-lead-measure";
import { KartuMmc } from "@/components/grd/kartu-mmc";
import { RekapPekanLead } from "@/components/grd/rekap-pekan-lead";
import { Reveal } from "@/components/motion/reveal";
import { DialogTambahLeadMeasure } from "@/components/grd/dialog-tambah-lead-measure";
import { bolehKelolaLeadMeasure, detailLeadMeasure } from "@/lib/data/grd";
import { pilihanGoal } from "@/lib/data/goal";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";
import { tanggalPanjang } from "@/lib/format";

export const metadata: Metadata = {
  title: "Lead Measure — K-Space V2",
  description: "Papan skor langkah kunci mingguan beserta entri hariannya.",
};

export default async function LeadMeasurePage({
  searchParams,
}: PageProps<"/grd/lead-measure">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const daftar = await detailLeadMeasure(pengguna, tanggal);
  const kelola = bolehKelolaLeadMeasure(pengguna);
  const goal = kelola ? (await pilihanGoal()).induk : [];

  // Senin pekan berjalan, dihitung dalam UTC agar tidak bergeser oleh zona waktu.
  const awal = new Date(`${tanggal}T00:00:00Z`);
  const isoDow = awal.getUTCDay() === 0 ? 7 : awal.getUTCDay();
  awal.setUTCDate(awal.getUTCDate() - (isoDow - 1));
  const awalPekan = awal.toISOString().slice(0, 10);

  // MMC dipisah tampilannya karena punya angka pendukung (peserta hadir)
  // yang melahirkan tingkat konversi acara.
  const mmc = daftar.find((m) =>
    m.labelPendukung?.toLowerCase().includes("mmc"),
  );

  return (
    <AppShell pengguna={pengguna} halaman="GRD">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/grd"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          GRD
        </Link>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Lead measure
            </h1>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              Langkah kunci yang bisa dikendalikan tim, dicatat harian ·{" "}
              {tanggalPanjang(tanggal)}
            </p>
          </div>
          {kelola && goal.length > 0 ? (
            <DialogTambahLeadMeasure
              goal={goal.map((g) => ({ id: g.id, judul: g.judul }))}
            />
          ) : null}
        </div>

        {daftar.length > 0 ? (
          <Reveal>
            <RekapPekanLead
              daftar={daftar}
              awalPekan={awalPekan}
              hariIni={tanggal}
            />
          </Reveal>
        ) : null}

        {mmc ? (
          <Reveal>
            <KartuMmc lead={mmc} />
          </Reveal>
        ) : null}

        {daftar.length === 0 ? (
          <p className="rounded-2xl bg-card px-5 py-4 text-[13px] leading-[18px] text-muted-foreground ring-1 ring-border-subtle">
            Belum ada lead measure aktif.
          </p>
        ) : (
          daftar.map((m) => (
            <Reveal key={m.id}>
              <EntriLeadMeasure lead={m} tanggal={tanggal} bolehIsi />
            </Reveal>
          ))
        )}
      </div>
    </AppShell>
  );
}
