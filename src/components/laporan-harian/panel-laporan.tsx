"use client";

import { useState } from "react";
import { FormLaporan } from "@/components/laporan-harian/form-laporan";
import { StatusAbsen } from "@/components/laporan-harian/status-absen";
import { RiwayatLaporan } from "@/components/laporan-harian/riwayat-laporan";
import { Reveal } from "@/components/motion/reveal";
import type { LaporanHarian, SasaranLaporan } from "@/lib/types";

/**
 * Menyatukan form dan status absensi agar kunci Absen Pulang selalu
 * mencerminkan apakah laporan hari ini sudah terkirim (PRD §2).
 */
export function PanelLaporan({
  sasaran,
  sudahDilaporkan,
  riwayat,
  hariIni,
  tanggal,
  jamMasuk,
  lokasi,
  sudahLaporAwal = false,
}: {
  sasaran: SasaranLaporan[];
  sudahDilaporkan: string[];
  riwayat: LaporanHarian[];
  hariIni: string;
  /** Tanggal laporan dalam format YYYY-MM-DD. */
  tanggal: string;
  jamMasuk: string;
  lokasi: string;
  sudahLaporAwal?: boolean;
}) {
  const [sudahLapor, setSudahLapor] = useState(sudahLaporAwal);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-12 lg:gap-6">
      <div className="space-y-4 lg:col-span-7 lg:space-y-6">
        <Reveal>
          <FormLaporan
            sasaran={sasaran}
            sudahDilaporkan={sudahDilaporkan}
            tanggal={tanggal}
            terkirim={sudahLapor}
            onUbahTerkirim={setSudahLapor}
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
