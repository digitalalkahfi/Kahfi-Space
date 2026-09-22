import { NextResponse, type NextRequest } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { rekapUnitGmv, seriGmvHarian } from "@/lib/data/gmv";
import {
  bandingkan,
  periksaRentangKustom,
  potongSepadan,
  ringkasGmv,
  seriDariAgregat,
  type TitikGmv,
} from "@/lib/gmv";
import {
  JENIS_PERIODE,
  hariDalamRentang,
  rentangPeriode,
  rentangSebelumnya,
  type JenisPeriode,
} from "@/lib/periode-finance";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { modeData } from "@/lib/supabase/config";

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

function jenisSah(nilai: string): nilai is JenisPeriode {
  return (JENIS_PERIODE as string[]).includes(nilai);
}

function salah(pesan: string) {
  return NextResponse.json({ pesan }, { status: 400 });
}

/** Bentuk titik yang dikirim keluar; tanpa `penyusun` yang berat. */
function keluar(t: TitikGmv) {
  return {
    tanggal: t.tanggal,
    gmv: t.gmv,
    jumlahLaporan: t.jumlahLaporan,
  };
}

/**
 * Dasbor Analitik GMV sebagai JSON.
 *
 * Halaman `/gmv` tidak memerlukannya — ia server component dan membaca
 * lapisan data langsung. Endpoint ini ada untuk yang di luar halaman:
 * laporan terjadwal, lembar kerja yang menyegarkan dirinya sendiri, dan
 * nanti ringkasan yang dikirim lewat WhatsApp.
 *
 * Parameter periodenya sama persis dengan yang dipakai halamannya
 * (`periode`, `acuan`, `dari`, `sampai`), dan dihitung oleh fungsi yang
 * sama — supaya sebuah URL dasbor bisa disalin ke sini apa adanya dan
 * menghasilkan angka yang sama.
 *
 * Cakupannya mengikuti RLS pemanggil: dua orang yang memanggil URL yang
 * sama bisa menerima angka berbeda, dan itu memang disengaja.
 */
export async function GET(request: NextRequest) {
  const pengguna = await sesiSaatIni();
  if (!pengguna) {
    return NextResponse.json(
      { pesan: "Silakan masuk lebih dulu." },
      { status: 401 },
    );
  }

  const p = request.nextUrl.searchParams;
  const hariIni =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  // Halaman boleh memaafkan parameter yang ngawur — ia punya tombol
  // untuk memperbaikinya. Endpoint tidak: skrip yang salah ketik
  // `periode=bulan` lebih baik mendapat penolakan yang menyebutkan
  // pilihannya daripada diam-diam menerima rentang lain.
  const periodeDiminta = p.get("periode");
  if (periodeDiminta !== null && !jenisSah(periodeDiminta)) {
    return salah(
      `Periode "${periodeDiminta}" tidak dikenal. Pilihannya: ${JENIS_PERIODE.join(", ")}.`,
    );
  }
  const jenis: JenisPeriode = periodeDiminta ?? "bulanan";

  for (const nama of ["acuan", "dari", "sampai"] as const) {
    const nilai = p.get(nama);
    if (nilai !== null && nilai !== "" && !POLA_TANGGAL.test(nilai)) {
      return salah(`Parameter "${nama}" harus berformat YYYY-MM-DD.`);
    }
  }

  const dari = p.get("dari") ?? undefined;
  const sampai = p.get("sampai") ?? undefined;
  if (jenis === "custom") {
    if (!dari || !sampai) {
      return salah('Periode "custom" memerlukan "dari" dan "sampai".');
    }
    const cek = periksaRentangKustom(dari, sampai);
    if (!cek.ok) return salah(cek.pesan);
  }

  const acuanDiminta = p.get("acuan") ?? "";
  const acuan = POLA_TANGGAL.test(acuanDiminta) ? acuanDiminta : hariIni;

  const rentang = rentangPeriode(jenis, acuan, { dari, sampai });
  const penuh = rentangSebelumnya(rentang);
  // Pembanding dipotong sepanjang hari yang sudah berjalan, sama
  // seperti halamannya — sebuah URL dasbor yang disalin ke sini harus
  // menghasilkan angka yang sama.
  const sepadan = potongSepadan(penuh, rentang, hariIni);
  const sebelumnya = { ...penuh, dari: sepadan.dari, sampai: sepadan.sampai };

  const [agregat, agregatSebelum, perUnit] = await Promise.all([
    seriGmvHarian(pengguna, rentang.dari, rentang.sampai),
    seriGmvHarian(pengguna, sebelumnya.dari, sebelumnya.sampai),
    rekapUnitGmv(pengguna, rentang.dari, rentang.sampai),
  ]);

  const titik = seriDariAgregat(agregat);
  const ringkas = ringkasGmv(titik);
  const ringkasSebelum = ringkasGmv(seriDariAgregat(agregatSebelum));
  const banding = bandingkan(ringkas.total, ringkasSebelum.total);

  return NextResponse.json(
    {
      periode: {
        jenis: rentang.jenis,
        dari: rentang.dari,
        sampai: rentang.sampai,
        label: rentang.label,
        hari: hariDalamRentang(rentang),
      },
      ringkasan: {
        total: ringkas.total,
        rataRata: ringkas.rataRata,
        hariTerlapor: ringkas.hariTerlapor,
        tertinggi: ringkas.tertinggi ? keluar(ringkas.tertinggi) : null,
        terendah: ringkas.terendah ? keluar(ringkas.terendah) : null,
      },
      pembanding: {
        dari: sebelumnya.dari,
        sampai: sebelumnya.sampai,
        label: penuh.label,
        // Periode berjalan dibandingkan dengan potongan periode
        // sebelumnya yang sama panjangnya, bukan dengan periode penuh.
        dipotongAgarSepadan: sepadan.dipotong,
        total: ringkasSebelum.total,
        hariTerlapor: ringkasSebelum.hariTerlapor,
        arah: banding.arah,
        selisih: banding.selisih,
        persen: banding.persen,
        tanpaPembanding: banding.tanpaPembanding,
      },
      perUnit,
      titik: titik.map(keluar),
      // Disebut di badan jawaban, bukan hanya di dokumentasi: siapa pun
      // yang memakai angka ini perlu tahu ia berasal dari laporan manual.
      sumber: "Laporan GMV harian yang diisi manual (tabel daily_reports).",
    },
    {
      headers: {
        // Angka ini bergantung pada cakupan pemanggilnya.
        "cache-control": "private, no-store",
      },
    },
  );
}
