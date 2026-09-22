import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { KelolaSoal } from "@/components/lms/kelola-soal";
import { PengerjaanKuis } from "@/components/lms/pengerjaan-kuis";
import {
  bolehKelolaKursus,
  kursusDariId,
  percobaanKuis,
  soalDenganKunci,
  soalKuis,
} from "@/lib/data/lms";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Kuis Modul — K-Space V2",
  description: "Kerjakan kuis modul dan lihat hasilnya.",
};

export default async function KuisPage({
  params,
  searchParams,
}: PageProps<"/lms/[id]/[urutan]/kuis">) {
  const [{ id, urutan }, { persona }] = await Promise.all([
    params,
    searchParams,
  ]);
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const kursus = await kursusDariId(pengguna, id);
  const modul = kursus?.modul.find((m) => String(m.urutan) === urutan);
  if (!kursus || !modul) notFound();

  const bolehKelola = bolehKelolaKursus(pengguna);
  const [soal, riwayat, soalKunci] = await Promise.all([
    soalKuis(modul.id),
    percobaanKuis(pengguna, kursus.id, modul.id),
    bolehKelola ? soalDenganKunci(modul.id) : Promise.resolve([]),
  ]);

  return (
    <AppShell pengguna={pengguna} halaman="Pembelajaran">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Link
          href={`/lms/${kursus.id}/${modul.urutan}`}
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          {modul.judul}
        </Link>

        <div>
          <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Modul {modul.urutan} · {kursus.judul}
          </p>
          <h1 className="mt-1 text-[24px] leading-8 font-bold tracking-tight text-pretty">
            Kuis: {modul.judul}
          </h1>
        </div>

        {soal.length === 0 ? (
          <Card className="rounded-3xl shadow-card ring-border-subtle">
            <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Modul ini belum punya soal kuis. Tandai tuntas langsung dari
              halaman modulnya.
            </p>
          </Card>
        ) : !kursus.terdaftar ? (
          <Card className="rounded-3xl shadow-card ring-border-subtle">
            <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Mulai kursusnya dulu sebelum mengerjakan kuis.
            </p>
          </Card>
        ) : (
          <PengerjaanKuis
            kursusId={kursus.id}
            modulId={modul.id}
            modulUrutan={modul.urutan}
            soal={soal}
            riwayat={riwayat}
          />
        )}

        {bolehKelola ? (
          <KelolaSoal
            kursusId={kursus.id}
            modulId={modul.id}
            daftar={soalKunci}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
