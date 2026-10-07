import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PanelLaporan } from "@/components/laporan-harian/panel-laporan";
import { tanggalPanjang } from "@/lib/format";
import { absensiHariIni } from "@/lib/data/absensi";
import {
  coSampelHariIni,
  hariIniLaporan,
  kalenderLaporan,
  mulaiSasaran,
  riwayatLaporan,
  sasaranUntuk,
  sudahDilaporkan,
} from "@/lib/data/laporan";
import { bulanDari } from "@/lib/kalender";
import {
  kunciSasaranLaporan,
  tanggalBolehLapor,
  tanggalDataTerakhir,
  tanggalLaporanPanjang,
} from "@/lib/laporan";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Laporan Harian — K-Space V2",
  description:
    "Satu form untuk mengisi GMV kemarin (satu hari penuh) dan catatan harian. Satu-satunya tempat input GMV.",
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
  // GMV dihitung satu hari penuh (24 jam): laporan yang dikirim hari ini
  // memuat GMV kemarin dan tersimpan bertanggal kemarin (H-1).
  const hariData = tanggalDataTerakhir(hariIni);

  // Yang tidak bergantung pada tanggal terpilih dimuat lebih dulu, sekaligus
  // tanggal mulai tiap sasaran (sejak terdaftar di K-Space).
  const [[sasaranHariData, mulaiPer], riwayat, absen] = await Promise.all([
    sasaranUntuk(pengguna, hariData).then(
      async (s) => [s, await mulaiSasaran(s)] as const,
    ),
    riwayatLaporan(pengguna, hariIni),
    // Absen selalu milik hari ini, berapa pun tanggal laporannya.
    absensiHariIni(pengguna, hariIni),
  ]);
  const mulaiTerawal = Object.values(mulaiPer).reduce<string | null>(
    (a, b) => (a === null || b < a ? b : a),
    null,
  );

  // Tanggal yang dilapor: kemarin, atau susulan yang dipilih dari
  // kalender (?tanggal=YYYY-MM-DD). Hari ini, masa depan, atau sebelum
  // sasaran terdaftar kembali ke kemarin.
  const tanggal =
    typeof diminta === "string" &&
    tanggalBolehLapor(diminta, hariIni, mulaiTerawal)
      ? diminta
      : hariData;

  const [sasaranTanggal, terlapor, coSampel, kalender] = await Promise.all([
    tanggal === hariData ? sasaranHariData : sasaranUntuk(pengguna, tanggal),
    sudahDilaporkan(pengguna, tanggal),
    coSampelHariIni(tanggal),
    kalenderLaporan(bulanDari(tanggal), hariIni, sasaranHariData, mulaiPer),
  ]);
  // Sasaran yang baru terdaftar sesudah tanggal itu tidak ditagih.
  const sasaran = sasaranTanggal.filter((s) => {
    const mulai = mulaiPer[kunciSasaranLaporan(s)];
    return !mulai || mulai <= tanggal;
  });

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
            Cukup satu form: pilih akun atau unit, isi GMV, tulis catatan. GMV
            dihitung satu hari penuh, jadi yang dilaporkan hari ini adalah GMV{" "}
            {tanggalLaporanPanjang(hariData)}.
          </p>
        </div>

        <PanelLaporan
          sasaran={sasaran}
          sudahDilaporkan={terlapor}
          riwayat={riwayat.slice(0, 3)}
          hariIni={hariIni}
          tanggal={tanggal}
          kalender={kalender}
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
