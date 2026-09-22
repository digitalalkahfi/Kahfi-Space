import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Bug, History, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { BalasanMasukan } from "@/components/masukan/balasan-masukan";
import { PanelPenanggung } from "@/components/masukan/panel-penanggung";
import { PanelStatusMasukan } from "@/components/masukan/panel-status-masukan";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { jamWib, tanggalPanjang, tanggalPendek } from "@/lib/format";
import {
  GAYA_JENIS,
  GAYA_KEPARAHAN,
  GAYA_STATUS_MASUKAN,
  LABEL_JENIS,
  LABEL_KEPARAHAN,
  LABEL_STATUS_MASUKAN,
} from "@/lib/masukan";
import { bolehKelolaMasukan, masukanDariId } from "@/lib/data/masukan";
import { daftarAnggota, peranValid, sesiSaatIni } from "@/lib/data/sesi";

export async function generateMetadata({
  params,
}: PageProps<"/masukan/[id]">): Promise<Metadata> {
  const { id } = await params;
  const pengguna = await sesiSaatIni();
  const masukan = pengguna ? await masukanDariId(pengguna, id) : null;

  return {
    title: masukan ? `${masukan.judul} — K-Space V2` : "Masukan — K-Space V2",
    description: "Masukan beserta tindak lanjut dan balasannya.",
  };
}

export default async function DetailMasukanPage({
  params,
  searchParams,
}: PageProps<"/masukan/[id]">) {
  const [{ id }, { persona }] = await Promise.all([params, searchParams]);
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const masukan = await masukanDariId(pengguna, id);
  if (!masukan) notFound();

  const bolehKelola = bolehKelolaMasukan(pengguna);
  const anggota = bolehKelola
    ? (await daftarAnggota()).map((a) => ({
        id: a.id,
        nama: a.nama,
        jabatan: a.jabatan,
      }))
    : [];

  const gaya = GAYA_STATUS_MASUKAN[masukan.status];

  return (
    <AppShell pengguna={pengguna} halaman="Masukan">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/masukan"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Masukan &amp; bug
        </Link>

        <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
          <div className="flex items-start gap-3 px-5">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-2xl",
                masukan.jenis === "bug"
                  ? "bg-danger-fill text-danger-text"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {masukan.jenis === "bug" ? (
                <Bug className="size-5" />
              ) : (
                <MessageSquare className="size-5" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] leading-7 font-bold tracking-tight text-pretty">
                {masukan.judul}
              </h1>
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                {masukan.pelaporNama ?? "Anonim"} ·{" "}
                {tanggalPanjang(masukan.dibuatPada)}
                {masukan.halaman ? ` · ${masukan.halaman}` : ""}
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
              {LABEL_STATUS_MASUKAN[masukan.status]}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                GAYA_JENIS[masukan.jenis],
              )}
            >
              {LABEL_JENIS[masukan.jenis]}
            </span>
            {masukan.keparahan ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                  GAYA_KEPARAHAN[masukan.keparahan],
                )}
              >
                {LABEL_KEPARAHAN[masukan.keparahan]}
              </span>
            ) : null}
          </div>

          {masukan.isi ? (
            <p className="px-5 text-[13px] leading-[20px] whitespace-pre-line text-pretty">
              {masukan.isi}
            </p>
          ) : null}

          {masukan.status === "ditolak" && masukan.alasanTolak ? (
            <p className="mx-5 rounded-2xl bg-muted px-4 py-2.5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Ditolak: {masukan.alasanTolak}
            </p>
          ) : null}
        </Card>

        {!bolehKelola && masukan.ditugaskanId === pengguna.id ? (
          <Reveal>
            <PanelPenanggung masukan={masukan} />
          </Reveal>
        ) : null}

        {bolehKelola ? (
          <Reveal>
            <PanelStatusMasukan masukan={masukan} anggota={anggota} />
          </Reveal>
        ) : null}

        <Reveal>
          <BalasanMasukan masukan={masukan} />
        </Reveal>

        {masukan.jejak.length > 0 ? (
          <Reveal>
            <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
              <h2 className="flex items-center gap-2 px-5 text-base leading-6 font-semibold">
                <History className="size-4 text-muted-foreground" />
                Jejak tindak lanjut
              </h2>

              <ol className="space-y-1.5 px-5">
                {masukan.jejak.map((j) => (
                  <li key={j.id} className="rounded-xl bg-muted/50 px-3 py-2">
                    <p className="text-[13px] leading-[18px] font-medium">
                      {j.dari
                        ? `${LABEL_STATUS_MASUKAN[j.dari]} → ${LABEL_STATUS_MASUKAN[j.ke]}`
                        : LABEL_STATUS_MASUKAN[j.ke]}
                    </p>
                    <p className="text-[11px] leading-[14px] text-muted-foreground">
                      {tanggalPendek(j.pada)} {jamWib(j.pada)}
                      {j.olehNama ? ` · ${j.olehNama}` : ""}
                    </p>
                    {j.catatan ? (
                      <p className="mt-0.5 text-[11px] leading-[14px] text-pretty">
                        {j.catatan}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Card>
          </Reveal>
        ) : null}
      </div>
    </AppShell>
  );
}
