"use client";

import { useState } from "react";
import { FormLaporan } from "@/components/laporan-harian/form-laporan";
import { StatusAbsen } from "@/components/laporan-harian/status-absen";
import { RiwayatLaporan } from "@/components/laporan-harian/riwayat-laporan";
import { Reveal } from "@/components/motion/reveal";
import type { KalenderLaporan } from "@/lib/laporan";
import type { LaporanHarian, SasaranLaporan } from "@/lib/types";

/**
 * Menyatukan form dan status absensi agar kunci Absen Pulang selalu
 * mencerminkan apakah laporan hari ini sudah terkirim (PRD §2). Laporan
 * susulan untuk hari yang terlewat tidak menyentuh kunci itu.
 */
export function PanelLaporan({
  sasaran,
  sudahDilaporkan,
  riwayat,
  hariIni,
  tanggal,
  kalender,
  persona,
  jamMasuk,
  lokasi,
  sudahLaporAwal = false,
  coSampel,
}: {
  sasaran: SasaranLaporan[];
  sudahDilaporkan: string[];
  riwayat: LaporanHarian[];
  hariIni: string;
  /** Tanggal laporan dalam format YYYY-MM-DD: hari ini, atau susulan. */
  tanggal: string;
  /** Status merah/hijau bulan tempat `tanggal` berada. */
  kalender: KalenderLaporan;
  /** Persona mode demo, dibawa saat berpindah tanggal. */
  persona?: string;
  jamMasuk: string;
  lokasi: string;
  sudahLaporAwal?: boolean;
  /** CO sampel pada tanggal laporan per kunci sasaran; dihitung, bukan diketik. */
  coSampel?: Record<string, number>;
}) {
  const [sudahLapor, setSudahLapor] = useState(sudahLaporAwal);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-12 lg:gap-6">
      <div className="space-y-4 lg:col-span-7 lg:space-y-6">
        <Reveal>
          {/* Berganti tanggal = form baru: isian dan sasaran terpilih
              tidak boleh terbawa dari tanggal sebelumnya. */}
          <FormLaporan
            key={tanggal}
            sasaran={sasaran}
            sudahDilaporkan={sudahDilaporkan}
            tanggal={tanggal}
            hariIni={hariIni}
            kalender={kalender}
            persona={persona}
            absenTerbuka={sudahLapor}
            onTerkirim={
              tanggal === hariIni ? () => setSudahLapor(true) : undefined
            }
            coSampel={coSampel}
          />
        </Reveal>
      </div>

      <div className="space-y-4 lg:col-span-5 lg:space-y-6">
        <Reveal>
          <StatusAbsen
            jamMasuk={jamMasuk}
            lokasi={lokasi}
            terkunci={!sudahLapor}
          />
        </Reveal>
        <Reveal>
          <RiwayatLaporan riwayat={riwayat} hariIni={hariIni} />
        </Reveal>
      </div>
    </div>
  );
}
