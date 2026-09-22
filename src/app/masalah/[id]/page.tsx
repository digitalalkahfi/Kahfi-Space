import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { JejakMasalahKartu } from "@/components/masalah/jejak-masalah";
import { KartuSolusi } from "@/components/masalah/kartu-solusi";
import { KontrolStatus } from "@/components/masalah/kontrol-status";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { tanggalPanjang } from "@/lib/format";
import {
  GAYA_DAMPAK,
  GAYA_STATUS_MASALAH,
  izinMasalah,
  LABEL_DAMPAK,
  LABEL_STATUS_MASALAH,
} from "@/lib/masalah";
import { jejakMasalah, masalahDariId } from "@/lib/data/masalah";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export async function generateMetadata({
  params,
}: PageProps<"/masalah/[id]">): Promise<Metadata> {
  const { id } = await params;
  const pengguna = await sesiSaatIni();
  const masalah = pengguna ? await masalahDariId(pengguna, id) : null;

  return {
    title: masalah ? `${masalah.judul} — K-Space V2` : "Kaizen — K-Space V2",
    description: "Laporan Kaizen beserta solusinya.",
  };
}

export default async function DetailMasalahPage({
  params,
  searchParams,
}: PageProps<"/masalah/[id]">) {
  const [{ id }, { persona }] = await Promise.all([params, searchParams]);
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const masalah = await masalahDariId(pengguna, id);
  if (!masalah) notFound();

  const gaya = GAYA_STATUS_MASALAH[masalah.status];
  const izin = izinMasalah(pengguna, masalah);

  const jejak = await jejakMasalah(masalah.id);

  return (
    <AppShell pengguna={pengguna} halaman="Kaizen">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/masalah"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Kaizen
        </Link>

        <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
          <div className="flex items-start gap-3 px-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <CircleAlert className="size-5" />
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] leading-7 font-bold tracking-tight text-pretty">
                {masalah.judul}
              </h1>
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                {masalah.unitNama}
                {masalah.pelaporNama
                  ? ` · dilaporkan ${masalah.pelaporNama}`
                  : ""}
                {" · "}
                {tanggalPanjang(masalah.dibuatPada)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 px-5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                gaya.kelas,
              )}
            >
              <span className={cn("size-1.5 rounded-full", gaya.titik)} />
              {LABEL_STATUS_MASALAH[masalah.status]}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                GAYA_DAMPAK[masalah.dampak],
              )}
            >
              {LABEL_DAMPAK[masalah.dampak]}
            </span>
          </div>

          {masalah.konteks ? (
            <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
              {masalah.konteks}
            </p>
          ) : null}
        </Card>

        {izin.ubahStatus ? (
          <Reveal>
            <KontrolStatus masalah={masalah} />
          </Reveal>
        ) : null}

        <Reveal>
          <KartuSolusi masalah={masalah} izin={izin} />
        </Reveal>

        <Reveal>
          <JejakMasalahKartu jejak={jejak} />
        </Reveal>
      </div>
    </AppShell>
  );
}
