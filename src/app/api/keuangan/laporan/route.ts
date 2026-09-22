import { NextResponse, type NextRequest } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { daftarTransaksi, kasAwal, ringkasPeriode } from "@/lib/data/keuangan";
import {
  bolehLihatKeuangan,
  kontribusiUnit,
  laporanCashFlow,
  laporanLabaRugi,
  rentangBulan,
  ringkasKeuangan,
  saringTransaksi,
  type BarisLaporan,
} from "@/lib/keuangan";
import { barisCsv, berkasCsv } from "@/lib/csv";
import { modeData } from "@/lib/supabase/config";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

function bagian(judul: string, baris: BarisLaporan[]) {
  return [
    barisCsv([judul]),
    barisCsv(["Pos", "Nilai", "Keterangan"]),
    ...baris.map((b) => barisCsv([b.label, b.nilai, b.catatan ?? ""])),
    "",
  ];
}

/**
 * Unduh laporan keuangan satu periode sebagai CSV.
 *
 * Ada dua jalan mengunduh laporan, dan keduanya memang perlu: tombol di
 * layar menghasilkan .xlsx berformat rapi untuk dibaca orang, endpoint
 * ini menghasilkan CSV polos yang bisa ditarik tautan, skrip, atau
 * lembar kerja yang menyegarkan dirinya sendiri.
 *
 * Cakupannya mengikuti pagar yang sama dengan halamannya: hanya Finance,
 * Manager, dan CEO. Tanpa itu, laporan lengkap perusahaan hanya berjarak
 * satu URL tebakan dari siapa pun yang sudah masuk.
 */
export async function GET(request: NextRequest) {
  const pengguna = await sesiSaatIni();
  if (!pengguna) {
    return NextResponse.json(
      { pesan: "Silakan masuk lebih dulu." },
      { status: 401 },
    );
  }
  if (!bolehLihatKeuangan(pengguna.role)) {
    return NextResponse.json(
      { pesan: "Laporan keuangan hanya untuk Finance, Manager, dan CEO." },
      { status: 403 },
    );
  }

  const params = request.nextUrl.searchParams;
  const hariIni =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);
  const bawaan = rentangBulan(hariIni);

  const diminta = {
    dari: params.get("dari") ?? "",
    sampai: params.get("sampai") ?? "",
  };
  const dari = POLA_TANGGAL.test(diminta.dari) ? diminta.dari : bawaan.dari;
  const sampai = POLA_TANGGAL.test(diminta.sampai)
    ? diminta.sampai
    : bawaan.sampai;

  if (sampai < dari) {
    return NextResponse.json(
      { pesan: "Tanggal akhir mendahului tanggal mulai." },
      { status: 400 },
    );
  }

  const [ringkas, semua, saldoPembuka] = await Promise.all([
    ringkasPeriode(dari, sampai),
    daftarTransaksi(pengguna),
    kasAwal(),
  ]);

  // Saldo awal periode = kas pembuka + seluruh mutasi sebelum tanggal
  // mulainya; tanpa itu "saldo kas awal" di laporan akan berbohong.
  const saldoAwal = ringkasKeuangan(
    semua.filter((t) => t.tanggal < dari),
    saldoPembuka,
  ).saldoKas;

  const periode = saringTransaksi(semua, {
    cari: "",
    arah: "semua",
    jenis: "semua",
    unit: "semua",
    status: "semua",
    dari,
    sampai,
  });

  const isi = berkasCsv([
    barisCsv(["Laporan keuangan K-Space V2"]),
    barisCsv(["Periode", dari, sampai]),
    barisCsv(["Disiapkan untuk", pengguna.nama, pengguna.role]),
    "",
    ...bagian("Arus kas", laporanCashFlow(ringkas, saldoAwal)),
    ...bagian("Laba rugi", laporanLabaRugi(ringkas)),
    barisCsv(["Kontribusi unit"]),
    barisCsv([
      "Unit",
      "Pendapatan",
      "Direct cost",
      "Creator share",
      "Net revenue",
      "Porsi (%)",
    ]),
    ...kontribusiUnit(periode).map((u) =>
      barisCsv([
        u.unitNama,
        u.pendapatan,
        u.directCost,
        u.creatorShare,
        u.netRevenue,
        u.porsi,
      ]),
    ),
  ]);

  return new NextResponse(isi, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="k-space-laporan-keuangan-${dari}-sd-${sampai}.csv"`,
      // Angka keuangan tidak boleh mengendap di cache bersama.
      "cache-control": "no-store",
    },
  });
}
