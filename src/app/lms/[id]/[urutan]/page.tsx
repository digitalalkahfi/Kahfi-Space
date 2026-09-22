import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PembacaModul } from "@/components/lms/pembaca-modul";
import { kursusDariId } from "@/lib/data/lms";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export async function generateMetadata({
  params,
}: PageProps<"/lms/[id]/[urutan]">): Promise<Metadata> {
  const { id, urutan } = await params;
  const pengguna = await sesiSaatIni();
  const kursus = pengguna ? await kursusDariId(pengguna, id) : null;
  const modul = kursus?.modul.find((m) => String(m.urutan) === urutan);

  return {
    title: modul ? `${modul.judul} — K-Space V2` : "Modul — K-Space V2",
    description: kursus?.judul,
  };
}

export default async function BacaModulPage({
  params,
  searchParams,
}: PageProps<"/lms/[id]/[urutan]">) {
  const [{ id, urutan }, { persona }] = await Promise.all([
    params,
    searchParams,
  ]);
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const kursus = await kursusDariId(pengguna, id);
  const modul = kursus?.modul.find((m) => String(m.urutan) === urutan);
  if (!kursus || !modul) notFound();

  return (
    <AppShell pengguna={pengguna} halaman="Pembelajaran">
      {/* Lebih sempit daripada halaman lain: baris panjang melelahkan dibaca. */}
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Link
          href={`/lms/${kursus.id}`}
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          {kursus.judul}
        </Link>

        <PembacaModul kursus={kursus} modul={modul} />
      </div>
    </AppShell>
  );
}
