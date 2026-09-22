import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PanelLaporan } from "@/components/laporan-harian/panel-laporan";
import { tanggalPanjang } from "@/lib/format";
import { absensiHariIni } from "@/lib/data/absensi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import {
  riwayatLaporan,
  sasaranUntuk,
  sudahDilaporkan,
} from "@/lib/data/laporan";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Laporan Harian — K-Space V2",
  description:
    "Satu form untuk mengisi GMV dan catatan harian. Satu-satunya tempat input GMV.",
};

export default async function LaporanHarianPage({
  searchParams,
}: PageProps<"/laporan-harian">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  // Mode demo mengunci "hari ini" ke tanggal acuan data contoh.
  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const [sasaran, riwayat, terlapor, absen] = await Promise.all([
    sasaranUntuk(pengguna, tanggal),
    riwayatLaporan(pengguna, tanggal),
    sudahDilaporkan(pengguna, tanggal),
    absensiHariIni(pengguna, tanggal),
  ]);

  const jamMasuk = absen.jamMasuk
    ? new Date(absen.jamMasuk)
        .toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Jakarta",
        })
        .replace(".", ":")
    : "--:--";

  const lokasi = !absen.ada
    ? "Belum absen masuk"
    : absen.jarakMeter !== null
      ? `Radius ${Math.round(absen.jarakMeter)} m · HQ Al-Kahfi`
      : absen.lokasiValid
        ? "Lokasi terverifikasi · HQ Al-Kahfi"
        : "Lokasi di luar radius kantor";

  return (
    <AppShell pengguna={pengguna} halaman="Laporan Harian">
      <div className="mx-auto w-full max-w-5xl space-y-4 lg:space-y-6">
        <div>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {tanggalPanjang(tanggal)}
          </p>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Laporan Harian
          </h1>
          <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
            Cukup satu form: pilih akun atau unit, isi GMV, tulis catatan.
          </p>
        </div>

        <PanelLaporan
          sasaran={sasaran}
          sudahDilaporkan={terlapor}
          riwayat={riwayat.slice(0, 3)}
          hariIni={tanggal}
          tanggal={tanggal}
          jamMasuk={jamMasuk}
          lokasi={lokasi}
          sudahLaporAwal={absen.sudahLapor}
        />
      </div>
    </AppShell>
  );
}
