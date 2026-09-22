import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowRight, CalendarRange, Stethoscope } from "lucide-react";
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
            Absen masuk dan pulang dengan selfie dan lokasi.
          </p>
        </div>

        <Reveal>
          <PanelAbsensi
            absen={absen}
            tanggal={tanggal}
            radiusMeter={aturan.radiusMeter}
            jamAturan={aturan.jamMasuk}
            belumDilapor={belumDilapor}
            kantor={KANTOR}
          />
        </Reveal>

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
                  Riwayat 30 hari terakhir, siap diunduh ke Excel.
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </Card>
        </Reveal>
      </div>
    </AppShell>
  );
}
