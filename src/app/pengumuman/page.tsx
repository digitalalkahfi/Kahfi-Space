import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft, ChevronRight, Pin } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { tanggalRelatif } from "@/lib/format";
import { ambilPengumuman } from "@/lib/data/pengumuman";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Pengumuman — K-Space V2",
  description: "Info dan arahan penting dari manajemen Al-Kahfi Corp.",
};

export default async function PengumumanPage({
  searchParams,
}: PageProps<"/pengumuman">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const daftar = await ambilPengumuman(pengguna);
  const hariIni = new Date().toISOString();

  return (
    <AppShell pengguna={pengguna} halaman="Pengumuman">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/beranda"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Beranda
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Pengumuman
          </h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Info dan arahan penting dari manajemen.
          </p>
        </div>

        {daftar.length === 0 ? (
          <Card className="rounded-3xl shadow-card ring-border-subtle">
            <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
              Belum ada pengumuman untukmu saat ini.
            </p>
          </Card>
        ) : (
          <Card className="rounded-3xl shadow-card ring-border-subtle">
            <ul className="space-y-0.5 px-5">
              {daftar.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/pengumuman/${p.id}`}
                    className="baris-interaktif flex items-start gap-3 rounded-2xl px-1 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        {p.disematkan ? (
                          <Pin className="size-3 shrink-0 text-secondary" />
                        ) : null}
                        <span className="truncate text-sm leading-5 font-semibold">
                          {p.judul}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-[18px] text-pretty text-muted-foreground">
                        {p.ringkasan}
                      </span>
                      <span className="mt-1 block text-[11px] leading-[14px] text-muted-foreground">
                        {p.jabatanPembuat} ·{" "}
                        {tanggalRelatif(p.publishedAt, hariIni)} ·{" "}
                        {p.targetUnit ?? p.targetPeran}
                      </span>
                    </span>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
