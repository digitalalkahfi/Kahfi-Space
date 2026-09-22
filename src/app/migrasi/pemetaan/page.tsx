import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { KartuPemetaan } from "@/components/migrasi/kartu-pemetaan";
import { Reveal } from "@/components/motion/reveal";
import {
  bolehMigrasi,
  eksporKvStore,
  persetujuanPemetaan,
} from "@/lib/data/migrasi";
import {
  medanTakTerpetakan,
  PEMETAAN,
  versiPemetaan,
} from "@/lib/pemetaan";
import { entitasDari } from "@/lib/kv-store";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Pemetaan Migrasi — K-Space V2",
  description:
    "Pemetaan medan kv_store ke skema baru, beserta persetujuan sebelum dijalankan.",
};

export default async function PemetaanPage({
  searchParams,
}: PageProps<"/migrasi/pemetaan">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");
  if (!bolehMigrasi(pengguna)) notFound();

  const [ekspor, persetujuan] = await Promise.all([
    eksporKvStore(),
    persetujuanPemetaan(),
  ]);

  // Medan yang benar-benar muncul di data lama, per entitas.
  const medanPerEntitas = new Map<string, Set<string>>();
  for (const e of ekspor.entri) {
    const jenis = entitasDari(e.key);
    if (!e.value || typeof e.value !== "object") continue;
    const kumpulan = medanPerEntitas.get(jenis) ?? new Set<string>();
    for (const k of Object.keys(e.value)) kumpulan.add(k);
    medanPerEntitas.set(jenis, kumpulan);
  }

  const kartu = PEMETAAN.map((p) => {
    const versi = versiPemetaan(p);
    return {
      pemetaan: p,
      versi,
      // Persetujuan hanya berlaku bila sidik versinya masih cocok.
      persetujuan:
        persetujuan.find((s) => s.entitas === p.kunci && s.versi === versi) ??
        null,
      medanAsing: medanTakTerpetakan(p, [
        ...(medanPerEntitas.get(p.kunci) ?? []),
      ]),
    };
  });

  const disetujui = kartu.filter((k) => k.persetujuan !== null).length;

  return (
    <AppShell pengguna={pengguna} halaman="Migrasi Data">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/migrasi"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Migrasi
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Pemetaan entitas
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Pemetaan menentukan bentuk akhir seluruh data perusahaan, jadi
            setiap entitas ditinjau dan disetujui lebih dulu.
          </p>
        </div>

        <Card
          className={
            disetujui === kartu.length
              ? "rounded-3xl bg-ok-fill shadow-none ring-0"
              : "rounded-3xl shadow-card ring-border-subtle"
          }
        >
          <p
            className={
              disetujui === kartu.length
                ? "flex items-start gap-2 px-5 text-[13px] leading-[18px] text-pretty text-ok-text"
                : "flex items-start gap-2 px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground"
            }
          >
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              {disetujui} dari {kartu.length} entitas disetujui.
              {disetujui === kartu.length
                ? " Migrasi sungguhan boleh dijalankan."
                : " Migrasi sungguhan menunggu seluruh entitas disetujui."}
            </span>
          </p>
        </Card>

        {kartu.map((k) => (
          <Reveal key={k.pemetaan.kunci}>
            <KartuPemetaan
              pemetaan={k.pemetaan}
              versi={k.versi}
              persetujuan={k.persetujuan}
              bolehSetujui
              medanAsing={k.medanAsing}
            />
          </Reveal>
        ))}
      </div>
    </AppShell>
  );
}
