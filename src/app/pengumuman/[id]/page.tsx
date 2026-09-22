import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft, Megaphone, Pin } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { jamWib, tanggalPanjang } from "@/lib/format";
import { ambilPengumumanSatu } from "@/lib/data/pengumuman";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export async function generateMetadata({
  params,
}: PageProps<"/pengumuman/[id]">): Promise<Metadata> {
  const { id } = await params;
  const pengguna = await sesiSaatIni();
  const pengumuman = pengguna ? await ambilPengumumanSatu(id, pengguna) : null;
  if (!pengumuman) return { title: "Pengumuman — K-Space V2" };

  return {
    title: `${pengumuman.judul} — K-Space V2`,
    description: pengumuman.ringkasan,
  };
}

export default async function DetailPengumumanPage({
  params,
  searchParams,
}: PageProps<"/pengumuman/[id]">) {
  const { id } = await params;
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const pengumuman = await ambilPengumumanSatu(id, pengguna);
  if (!pengumuman) notFound();

  return (
    <AppShell pengguna={pengguna} halaman="Pengumuman">
      <article className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/pengumuman"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Semua pengumuman
        </Link>

        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <div className="space-y-4 px-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-primary-foreground uppercase">
                <Megaphone className="size-3" />
                Info Operasional
              </span>
              {pengumuman.disematkan ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-info-fill px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-info-text">
                  <Pin className="size-3" />
                  Disematkan
                </span>
              ) : null}
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-muted-foreground">
                {pengumuman.targetUnit
                  ? `Unit ${pengumuman.targetUnit}`
                  : pengumuman.targetPeran === "Semua"
                    ? "Semua peran"
                    : `Peran ${pengumuman.targetPeran}`}
              </span>
            </div>

            <div>
              <h1 className="text-[22px] leading-7 font-bold tracking-tight text-balance lg:text-[28px] lg:leading-9">
                {pengumuman.judul}
              </h1>
              <p className="mt-1.5 text-[13px] leading-[18px] text-muted-foreground">
                {pengumuman.dibuatOleh} · {pengumuman.jabatanPembuat}
              </p>
              <p className="text-[13px] leading-[18px] text-muted-foreground">
                {tanggalPanjang(pengumuman.publishedAt)} ·{" "}
                {jamWib(pengumuman.publishedAt)}
              </p>
            </div>

            <div className="space-y-3 border-t border-border-subtle pt-4">
              {pengumuman.isi.map((paragraf, i) => (
                <p
                  key={i}
                  className="text-[15px] leading-[22px] text-pretty text-foreground/90"
                >
                  {paragraf}
                </p>
              ))}
            </div>
          </div>
        </Card>
      </article>
    </AppShell>
  );
}
