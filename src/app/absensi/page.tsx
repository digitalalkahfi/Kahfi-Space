import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import {
  ArrowRight,
  CalendarRange,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { PanelAbsensi } from "@/components/absensi/panel-absensi";
import { Reveal } from "@/components/motion/reveal";
import { absensiHariIni, pengaturanAbsensi } from "@/lib/data/absensi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { sasaranUntuk, sudahDilaporkan } from "@/lib/data/laporan";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";
import { tanggalPanjang } from "@/lib/format";
import { KANTOR } from "@/lib/geo";
import { wajibAbsen } from "@/lib/rekap-kehadiran";

export const metadata: Metadata = {
  title: "Absensi — K-Space V2",
  description:
    "Absen masuk dan pulang dengan selfie dan lokasi; pulang terbuka setelah laporan harian.",
};

export default async function AbsensiPage({
  searchParams,
}: PageProps<"/absensi">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const [absen, aturan, sasaran, terlapor] = await Promise.all([
    absensiHariIni(pengguna, tanggal),
    pengaturanAbsensi(),
    sasaranUntuk(pengguna, tanggal),
    sudahDilaporkan(pengguna, tanggal),
  ]);

  const kunciSasaran = (s: (typeof sasaran)[number]) =>
    s.jenis === "akun" ? `akun:${s.akun.id}` : `unit:${s.unitId}`;
  // Hanya sasaran yang menjadi tanggung jawab pengguna ini.
  const sasaranSaya = sasaran.filter((s) =>
    s.jenis === "akun" ? s.akun.picNama === pengguna.nama : true,
  );
  const belumDilapor = sasaranSaya.filter(
    (s) => !terlapor.includes(kunciSasaran(s)),
  );

  // Leader ke bawah wajib absen. CEO, Manager, dan Finance memantau,
  // bukan dipantau: bagi mereka rekap timlah yang utama, dan absen di
  // halaman ini bersifat sukarela.
  const wajib = wajibAbsen(pengguna.role);
  const bolehTim = ["CEO", "Manager", "Leader", "Co-Leader"].includes(
    pengguna.role,
  );

  const panel = (
    <Reveal>
      <div>
        {!wajib ? (
          <p className="mb-2 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Absen sukarela
          </p>
        ) : null}
        <PanelAbsensi
          absen={absen}
          tanggal={tanggal}
          radiusMeter={aturan.radiusMeter}
          jamAturan={aturan.jamMasuk}
          belumDilapor={belumDilapor}
          kantor={KANTOR}
        />
      </div>
    </Reveal>
  );

  const kartuIzin = (
    <Reveal>
      <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
        <Link
          href="/absensi/izin"
          className="flex items-center gap-4 px-5 py-1"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accentmuted-fill text-accentmuted-text">
            <Stethoscope className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base leading-6 font-semibold">
              Izin &amp; sakit
            </span>
            <span className="block text-[13px] leading-[18px] text-muted-foreground">
              Ajukan dan pantau persetujuan atasan.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </Card>
    </Reveal>
  );

  const kartuRekap = (
    <Reveal>
      <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
        <Link
          href="/absensi/rekap"
          className="flex items-center gap-4 px-5 py-1"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-info-fill text-info-text">
            <CalendarRange className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base leading-6 font-semibold">
              Rekap kehadiran
            </span>
            <span className="block text-[13px] leading-[18px] text-muted-foreground">
              {bolehTim
                ? "Siapa hadir, tidak hadir, dan keterangannya — per orang, siap diunduh ke Excel."
                : "Riwayat kehadiran Anda per periode, siap diunduh ke Excel."}
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </Card>
    </Reveal>
  );

  return (
    <AppShell pengguna={pengguna} halaman="Absensi">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {tanggalPanjang(tanggal)}
          </p>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Absensi
          </h1>
          <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
            {wajib
              ? "Absen masuk dan pulang dengan selfie dan lokasi."
              : "Pantau kehadiran tim; absen untuk peran Anda bersifat sukarela."}
          </p>
        </div>

        {wajib ? (
          <>
            {panel}
            {kartuIzin}
            {kartuRekap}
          </>
        ) : (
          <>
            <Reveal>
              <Card className="rounded-3xl bg-info-fill shadow-card ring-border-subtle">
                <div className="flex items-start gap-4 px-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-card text-info-text">
                    <ShieldCheck className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base leading-6 font-semibold text-info-text">
                      Anda tidak wajib absen
                    </p>
                    <p className="text-[13px] leading-[18px] text-pretty text-info-text/80">
                      Kewajiban absen berlaku untuk Leader, Co-Leader, dan
                      Staff. Sebagai {pengguna.role}, kehadiran Anda tidak
                      ditagih
                      {bolehTim
                        ? "; Anda memantau kehadiran seluruh tim lewat rekap di bawah."
                        : "."}
                    </p>
                  </div>
                </div>
              </Card>
            </Reveal>
            {kartuRekap}
            {kartuIzin}
            {panel}
          </>
        )}
      </div>
    </AppShell>
  );
}
