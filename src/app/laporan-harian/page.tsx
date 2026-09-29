import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PanelLaporan } from "@/components/laporan-harian/panel-laporan";
import { tanggalPanjang } from "@/lib/format";
import { absensiHariIni } from "@/lib/data/absensi";
import {
  coSampelHariIni,
  hariIniLaporan,
  laporanTerlewat,
  riwayatLaporan,
  sasaranUntuk,
  sudahDilaporkan,
} from "@/lib/data/laporan";
import { tanggalBolehLapor } from "@/lib/laporan";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Laporan Harian — K-Space V2",
  description:
    "Satu form untuk mengisi GMV dan catatan harian. Satu-satunya tempat input GMV.",
};

export default async function LaporanHarianPage({
  searchParams,
}: PageProps<"/laporan-harian">) {
  const { persona, tanggal: diminta } = await searchParams;
  const personaSah = peranValid(persona) ? persona : undefined;
  const pengguna = await sesiSaatIni(personaSah);
  if (!pengguna) redirect("/masuk");

  // Mode demo mengunci "hari ini" ke tanggal acuan data contoh.
  const hariIni = hariIniLaporan();
  // Tanggal yang dilapor: hari ini, atau susulan yang dipilih di form
  // (?tanggal=YYYY-MM-DD). Di luar batas susulan kembali ke hari ini.
  const tanggal =
    typeof diminta === "string" && tanggalBolehLapor(diminta, hariIni)
      ? diminta
      : hariIni;

  // Daftar sasaran hari ini juga menjadi dasar hari-hari yang terlewat.
  const sasaranHariIni = sasaranUntuk(pengguna, hariIni);
  const [sasaran, riwayat, terlapor, absen, coSampel, terlewat] =
    await Promise.all([
      tanggal === hariIni ? sasaranHariIni : sasaranUntuk(pengguna, tanggal),
      riwayatLaporan(pengguna, hariIni),
      sudahDilaporkan(pengguna, tanggal),
      // Absen selalu milik hari ini, berapa pun tanggal laporannya.
      absensiHariIni(pengguna, hariIni),
      coSampelHariIni(tanggal),
      sasaranHariIni.then((s) => laporanTerlewat(hariIni, s)),
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
            {tanggalPanjang(hariIni)}
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
          hariIni={hariIni}
          tanggal={tanggal}
          terlewat={terlewat}
          persona={personaSah}
          jamMasuk={jamMasuk}
          lokasi={lokasi}
          sudahLaporAwal={absen.sudahLapor}
          coSampel={coSampel}
        />
      </div>
    </AppShell>
  );
}
