import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, Pin } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Reveal } from "@/components/motion/reveal";
import { Card } from "@/components/ui/card";
import { AksiCatatan } from "@/components/catatan/aksi-catatan";
import { cn } from "@/lib/utils";
import { tanggalPanjang } from "@/lib/format";
import {
  GAYA_KATEGORI_CATATAN,
  GAYA_VISIBILITAS,
  LABEL_KATEGORI_CATATAN,
  LABEL_VISIBILITAS,
  izinCatatan,
} from "@/lib/catatan";
import { catatanDariId } from "@/lib/data/catatan";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export async function generateMetadata({
  params,
}: PageProps<"/catatan/[id]">): Promise<Metadata> {
  const { id } = await params;
  const pengguna = await sesiSaatIni();
  const catatan = pengguna ? await catatanDariId(pengguna, id) : null;
  return {
    title: `${catatan?.judul ?? "Catatan"} — K-Space V2`,
  };
}

export default async function DetailCatatanPage({
  params,
  searchParams,
}: PageProps<"/catatan/[id]">) {
  const { id } = await params;
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const [catatan, pilihan] = await Promise.all([
    catatanDariId(pengguna, id),
    pilihanOrganisasi(),
  ]);
  if (!catatan) notFound();

  const izin = izinCatatan(pengguna, catatan);

  return (
    <AppShell pengguna={pengguna} halaman="Catatan">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/catatan"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-4" />
          Semua catatan
        </Link>

        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <div className="space-y-3 px-5">
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <h1 className="flex items-start gap-2 text-[22px] leading-7 font-bold tracking-tight text-pretty">
                  {izin.milik && catatan.disematkan ? (
                    <Pin className="mt-1 size-5 shrink-0 text-muted-foreground" />
                  ) : null}
                  {catatan.judul}
                </h1>
                <p className="text-[11px] leading-[14px] text-muted-foreground">
                  {izin.milik ? "Ditulis olehmu" : catatan.pemilikNama}
                  {catatan.visibilitas === "unit" && catatan.unitNama
                    ? ` · ${catatan.unitNama}`
                    : ""}{" "}
                  · diubah {tanggalPanjang(catatan.diperbaruiPada)}
                </p>
              </div>
              <span className="flex flex-wrap gap-1">
                <span
                  className={cn(
                    "rounded-full px-2 py-1 text-[10px] leading-[14px] font-semibold",
                    GAYA_KATEGORI_CATATAN[catatan.kategori],
                  )}
                >
                  {LABEL_KATEGORI_CATATAN[catatan.kategori]}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-1 text-[10px] leading-[14px] font-semibold",
                    GAYA_VISIBILITAS[catatan.visibilitas],
                  )}
                >
                  {LABEL_VISIBILITAS[catatan.visibilitas]}
                </span>
              </span>
            </div>

            {izin.milik ? (
              <AksiCatatan catatan={catatan} pilihan={pilihan} />
            ) : null}
          </div>
        </Card>

        <Reveal>
          <Card className="rounded-3xl shadow-card ring-border-subtle">
            <div className="space-y-4 px-5">
              {catatan.isi ? (
                <p className="text-[14px] leading-6 text-pretty whitespace-pre-wrap">
                  {catatan.isi}
                </p>
              ) : (
                <p className="text-[13px] leading-[18px] text-muted-foreground">
                  Catatan ini belum berisi apa-apa.
                </p>
              )}

              {catatan.lampiran.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                    Lampiran
                  </p>
                  <ul className="space-y-1">
                    {catatan.lampiran.map((l) => (
                      <li key={l}>
                        <a
                          href={l}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 text-[13px] leading-[18px] text-primary hover:underline"
                        >
                          <ExternalLink className="size-3.5 shrink-0" />
                          <span className="truncate">{l}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Card>
        </Reveal>
      </div>
    </AppShell>
  );
}
