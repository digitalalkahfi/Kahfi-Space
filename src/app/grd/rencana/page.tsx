import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { DaftarRencana } from "@/components/grd/daftar-rencana";
import { Reveal } from "@/components/motion/reveal";
import { rencanaGrd } from "@/lib/data/rencana";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";
import { bulanPanjang, hariIniWib, persen } from "@/lib/format";
import { ringkasTonggak } from "@/lib/rencana";

export const metadata: Metadata = {
  title: "Rencana operasional — K-Space V2",
  description:
    "Operational plan GRD: siapa mengerjakan apa, kapan, dan tonggak yang selesai tepat waktu.",
};

export default async function RencanaPage({
  searchParams,
}: PageProps<"/grd/rencana">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const hariIni = modeData() === "demo" ? TANGGAL_ACUAN : hariIniWib();
  const periode = `${hariIni.slice(0, 7)}-01`;
  const daftar = await rencanaGrd(pengguna, periode);
  const ringkas = ringkasTonggak(
    daftar.flatMap((r) => r.tonggak),
    hariIni,
  );

  const angkaRingkas = [
    { label: "Jatuh tempo", nilai: String(ringkas.jatuh) },
    {
      label: "Tepat waktu",
      nilai:
        ringkas.persen === null
          ? "—"
          : `${ringkas.tepat} · ${persen(ringkas.persen, 0)}`,
    },
    { label: "Terlambat", nilai: String(ringkas.terlambat) },
    { label: "Lewat tenggat", nilai: String(ringkas.lewat) },
  ];

  return (
    <AppShell pengguna={pengguna} halaman="GRD">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Link
          href="/grd"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          GRD
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Rencana operasional
          </h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {bulanPanjang(periode)} · cara mencapai tiap goal: siapa, kapan, dan
            tonggak yang dicentang selesai.
          </p>
        </div>

        {daftar.length > 0 ? (
          <Reveal>
            <Card className="rounded-3xl shadow-card ring-border-subtle">
              <dl className="grid grid-cols-2 gap-4 px-5 sm:grid-cols-4">
                {angkaRingkas.map((a) => (
                  <div key={a.label}>
                    <dt className="text-[11px] leading-[14px] text-muted-foreground">
                      {a.label}
                    </dt>
                    <dd className="tabular text-[20px] leading-7 font-bold">
                      {a.nilai}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="px-5 text-[11px] leading-[14px] text-muted-foreground">
                Ketuk tonggak untuk mengubah statusnya bila kamu PIC-nya, atasan
                PIC, atau CEO/Manager. Hijau = selesai tepat waktu, kuning =
                selesai terlambat, merah = lewat tenggat.
              </p>
            </Card>
          </Reveal>
        ) : null}

        <Reveal>
          <DaftarRencana daftar={daftar} hariIni={hariIni} />
        </Reveal>
      </div>
    </AppShell>
  );
}
