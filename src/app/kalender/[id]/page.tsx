import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, MapPin, TriangleAlert, User } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { tanggalPanjang, tanggalPendek } from "@/lib/format";
import { agendaDariId } from "@/lib/data/kalender";
import { GAYA_JENIS_AGENDA, LABEL_JENIS_AGENDA } from "@/lib/kalender";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Detail Agenda — K-Space V2",
  description: "Satu agenda kalender bersama beserta acara yang bentrok.",
};

export default async function DetailAgendaPage({
  params,
  searchParams,
}: PageProps<"/kalender/[id]">) {
  const [{ id }, { persona }] = await Promise.all([params, searchParams]);
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const hasil = await agendaDariId(pengguna, id);
  if (!hasil) notFound();

  const { entri, bentrok } = hasil;
  const gaya = GAYA_JENIS_AGENDA[entri.jenis];

  return (
    <AppShell pengguna={pengguna} halaman="Kalender">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Link
          href="/kalender"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Kalender
        </Link>

        <Reveal>
          <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
            <div className="space-y-1.5 px-5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
                  gaya.kelas,
                )}
              >
                <span className={cn("size-1.5 rounded-full", gaya.titik)} />
                {LABEL_JENIS_AGENDA[entri.jenis]}
              </span>

              <h1 className="text-[22px] leading-7 font-bold tracking-tight text-pretty">
                {entri.judul}
              </h1>

              <p className="text-[13px] leading-[18px] text-muted-foreground">
                {tanggalPanjang(entri.tanggal)} · {entri.unitNama}
              </p>
            </div>

            <dl className="grid gap-2 px-5 sm:grid-cols-2">
              <div className="rounded-2xl bg-muted/50 p-3">
                <dt className="flex items-center gap-1.5 text-[11px] leading-[14px] text-muted-foreground">
                  <Clock className="size-3" />
                  Waktu
                </dt>
                <dd className="text-[13px] leading-[18px] font-semibold">
                  {entri.jamMulai
                    ? `${entri.jamMulai}${entri.jamSelesai ? `–${entri.jamSelesai}` : ""}`
                    : "Sepanjang hari"}
                </dd>
              </div>

              <div className="rounded-2xl bg-muted/50 p-3">
                <dt className="flex items-center gap-1.5 text-[11px] leading-[14px] text-muted-foreground">
                  <MapPin className="size-3" />
                  Lokasi
                </dt>
                <dd className="text-[13px] leading-[18px] font-semibold">
                  {entri.lokasi || "—"}
                </dd>
              </div>

              {entri.dibuatOleh ? (
                <div className="rounded-2xl bg-muted/50 p-3 sm:col-span-2">
                  <dt className="flex items-center gap-1.5 text-[11px] leading-[14px] text-muted-foreground">
                    <User className="size-3" />
                    Dibuat oleh
                  </dt>
                  <dd className="text-[13px] leading-[18px] font-semibold">
                    {entri.dibuatOleh}
                  </dd>
                </div>
              ) : null}
            </dl>

            {entri.keterangan ? (
              <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
                {entri.keterangan}
              </p>
            ) : null}
          </Card>
        </Reveal>

        {bentrok.length > 0 ? (
          <Reveal>
            <Card className="rounded-3xl shadow-card ring-border-subtle">
              <div className="px-5">
                <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
                  <TriangleAlert className="size-4 text-warn-text" />
                  Bentrok dengan {bentrok.length} acara lain
                </h2>
                <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
                  Jamnya beririsan dan pesertanya beririsan pula. Bukan
                  larangan — tetapi seseorang harus memilih salah satunya.
                </p>
              </div>

              <ul className="space-y-2 px-5">
                {bentrok.map((b) => (
                  <li key={b.id} className="rounded-2xl bg-warn-fill/40 p-3">
                    <p className="text-[13px] leading-[18px] font-semibold text-pretty">
                      {b.sumber === "agenda" ? (
                        <Link
                          href={`/kalender/${b.id}`}
                          className="hover:underline"
                        >
                          {b.judul}
                        </Link>
                      ) : (
                        b.judul
                      )}
                    </p>
                    <p className="text-[11px] leading-[14px] text-muted-foreground">
                      {tanggalPendek(b.tanggal)} · {b.jamMulai}
                      {b.jamSelesai ? `–${b.jamSelesai}` : ""} · {b.unitNama}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        ) : null}
      </div>
    </AppShell>
  );
}
