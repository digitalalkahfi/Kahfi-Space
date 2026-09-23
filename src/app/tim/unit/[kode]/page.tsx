import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Store, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { PohonStruktur } from "@/components/tim/pohon-struktur";
import { cn } from "@/lib/utils";
import { bilangan } from "@/lib/format";
import { gayaUnit } from "@/lib/unit";
import { kodeUnitSah, UNIT_PELAPORAN } from "@/lib/unit-pelaporan";
import { pohonStruktur } from "@/lib/struktur";
import { daftarAnggotaTim } from "@/lib/data/anggota";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Unit — K-Space V2",
  description:
    "Anggota, akun, dan cara pelaporan satu unit: Affiliator, MCN, atau TAP.",
};

/**
 * Halaman satu unit pelaporan.
 *
 * Tiga unit ini bukan sekadar label penyaring: cara melaporkannya
 * berbeda — Affiliator melapor per akun, MCN & TAP per unit — dan
 * perbedaan itu menentukan siapa yang wajib mengisi laporan harian.
 * Halaman ini tempat perbedaan itu dijelaskan sekali, bukan diulang
 * sebagai catatan kaki di tiap layar.
 */
export default async function UnitPage({
  params,
  searchParams,
}: PageProps<"/tim/unit/[kode]">) {
  const { kode } = await params;
  const { persona } = await searchParams;
  if (!kodeUnitSah(kode)) notFound();

  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const [semua, pilihan] = await Promise.all([
    daftarAnggotaTim(pengguna),
    pilihanOrganisasi(),
  ]);

  const unit = UNIT_PELAPORAN[kode];
  const gaya = gayaUnit[kode];
  const anggota = semua.filter((a) => a.unitKode === kode);
  const aktif = anggota.filter((a) => a.status === "aktif");
  const akun = pilihan.akun.filter((a) => a.unitKode === kode);
  const program = pilihan.program.filter((p) => p.unitKode === kode);

  // Pohonnya dibangun dari anggota unit ini saja: yang atasannya di
  // luar unit otomatis menjadi akar, dan itu memang yang ingin terlihat
  // — susunan di dalam unitnya, bukan seluruh perusahaan lagi.
  const pohon = pohonStruktur(aktif);

  const angka = [
    { label: "Anggota aktif", nilai: bilangan(aktif.length) },
    {
      label: "Akun dipegang",
      nilai: akun.length === 0 ? "—" : bilangan(akun.length),
    },
    {
      label: "Program",
      nilai: program.length === 0 ? "—" : bilangan(program.length),
    },
  ];

  return (
    <AppShell pengguna={pengguna} halaman="Anggota Tim">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/tim/struktur"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Struktur organisasi
        </Link>

        <div className="flex items-start gap-3">
          <span
            className={cn("mt-1 size-2.5 shrink-0 rounded-full", gaya.bar)}
            aria-hidden
          />
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              {unit.nama}
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              {unit.ringkas}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {angka.map((a) => (
            <Card
              key={a.label}
              className="rounded-2xl shadow-card ring-border-subtle"
            >
              <div className="px-4">
                <p className="text-[11px] leading-[14px] text-muted-foreground">
                  {a.label}
                </p>
                <p className="tabular mt-0.5 text-base leading-6 font-bold tracking-tight">
                  {a.nilai}
                </p>
              </div>
            </Card>
          ))}
        </div>

        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <div className="space-y-2 px-5">
            <h2 className="text-base leading-6 font-semibold">
              Cara melaporkan
            </h2>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              {unit.lapor === "akun"
                ? "Laporan harian diisi per AKUN: tiap PIC mengisi akunnya sendiri, dan akun tanpa PIC tidak akan pernah terlapor."
                : "Laporan harian diisi per UNIT: Leader unit mengisinya sekali untuk seluruh unit, bukan per akun."}
            </p>
            {unit.kolomTambahan.length > 0 ? (
              <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
                Selain GMV, unit ini mengisi {unit.kolomTambahan.join(", ")}.
              </p>
            ) : (
              <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
                Unit ini hanya mengisi GMV; kolom komisi dan unggahan khusus
                Affiliator.
              </p>
            )}
          </div>
        </Card>

        {akun.length > 0 ? (
          <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
            <div className="flex items-start justify-between gap-3 px-5">
              <div>
                <h2 className="text-base leading-6 font-semibold">
                  Akun unit ini
                </h2>
                <p className="text-[13px] leading-[18px] text-muted-foreground">
                  Tiap akun dipegang satu PIC yang mengisi laporan hariannya.
                </p>
              </div>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
                <Store className="size-4" />
              </span>
            </div>

            <ul className="flex flex-wrap gap-1.5 px-5">
              {akun.map((a) => (
                <li
                  key={a.id}
                  className="rounded-full bg-muted px-2.5 py-1 text-[11px] leading-[14px] font-semibold"
                >
                  {a.username}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {aktif.length === 0 ? (
          <Card className="rounded-3xl shadow-card ring-border-subtle">
            <p className="flex items-center gap-2 px-5 text-[13px] leading-[18px] text-muted-foreground">
              <Users className="size-4 shrink-0" aria-hidden />
              Belum ada anggota aktif di unit ini.
            </p>
          </Card>
        ) : (
          <Reveal>
            <PohonStruktur pohon={pohon} />
          </Reveal>
        )}
      </div>
    </AppShell>
  );
}
