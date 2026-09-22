import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen, Clock } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { DaftarModul } from "@/components/lms/daftar-modul";
import { KelolaModul } from "@/components/lms/kelola-modul";
import { TombolUbahKursus } from "@/components/lms/tombol-ubah-kursus";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { tanggalPanjang } from "@/lib/format";
import {
  GAYA_TINGKAT,
  LABEL_TINGKAT,
  totalMenit,
  wajibBagi,
} from "@/lib/lms";
import { bolehKelolaKursus, kursusDariId } from "@/lib/data/lms";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export async function generateMetadata({
  params,
}: PageProps<"/lms/[id]">): Promise<Metadata> {
  const { id } = await params;
  const pengguna = await sesiSaatIni();
  const kursus = pengguna ? await kursusDariId(pengguna, id) : null;

  return {
    title: kursus ? `${kursus.judul} — K-Space V2` : "Kursus — K-Space V2",
    description: kursus?.ringkasan,
  };
}

export default async function DetailKursusPage({
  params,
  searchParams,
}: PageProps<"/lms/[id]">) {
  const [{ id }, { persona }] = await Promise.all([params, searchParams]);
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const kursus = await kursusDariId(pengguna, id);
  if (!kursus) notFound();

  const wajib = wajibBagi(kursus, pengguna.role);
  const bolehKelola = bolehKelolaKursus(pengguna);
  const pilihan = bolehKelola ? await pilihanOrganisasi() : null;

  return (
    <AppShell pengguna={pengguna} halaman="Pembelajaran">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/lms"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Pembelajaran
        </Link>

        <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
          <div className="flex items-start gap-3 px-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <BookOpen className="size-5" />
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] leading-7 font-bold tracking-tight text-pretty">
                {kursus.judul}
              </h1>
              <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
                {kursus.ringkasan}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 px-5">
            {wajib ? (
              <span className="rounded-full bg-danger-fill px-2.5 py-1 text-[10px] leading-[14px] font-semibold text-danger-text">
                Wajib untuk {pengguna.role}
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                GAYA_TINGKAT[kursus.tingkat],
              )}
            >
              {LABEL_TINGKAT[kursus.tingkat]}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] leading-[14px] font-semibold text-muted-foreground">
              {kursus.kategori}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] leading-[14px] font-semibold text-muted-foreground">
              <Clock className="size-3" />
              {totalMenit(kursus)} menit
            </span>
          </div>

          {kursus.selesaiPada ? (
            <p className="px-5 text-[11px] leading-[14px] text-muted-foreground">
              Diselesaikan {tanggalPanjang(kursus.selesaiPada)}.
            </p>
          ) : null}

          {bolehKelola && pilihan ? (
            <div className="px-5">
              <TombolUbahKursus kursus={kursus} pilihan={pilihan} />
            </div>
          ) : null}
        </Card>

        <Reveal>
          <DaftarModul kursus={kursus} />
        </Reveal>

        {bolehKelola && pilihan ? (
          <Reveal>
            <KelolaModul kursus={kursus} />
          </Reveal>
        ) : null}
      </div>
    </AppShell>
  );
}
