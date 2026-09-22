import { NextResponse, type NextRequest } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { laporanGmv } from "@/lib/data/gmv";
import { labelTanggal, periksaRentangKustom, seriHarian } from "@/lib/gmv";
import { barisCsv, berkasCsv } from "@/lib/csv";

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Rincian GMV satu hari: laporan mana saja yang menyusun angkanya.
 *
 * Terpisah dari `/api/gmv` dengan sengaja. Endpoint itu menjawab
 * "berapa" untuk sebuah rentang dan sudah diringkas basis data;
 * endpoint ini menjawab "dari mana" untuk satu hari, dan karena itu
 * memang perlu baris per laporan. Menggabungkannya berarti setiap
 * permintaan ringkasan ikut menyeret seluruh laporannya.
 *
 * `format=csv` menghasilkan berkas yang bisa ditarik lembar kerja —
 * jalan yang sama dengan laporan keuangan (`/api/keuangan/laporan`).
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
  const tanggal = p.get("tanggal") ?? "";
  if (!POLA_TANGGAL.test(tanggal)) {
    return NextResponse.json(
      { pesan: 'Sertakan "tanggal" berformat YYYY-MM-DD.' },
      { status: 400 },
    );
  }
  // Satu hari adalah rentang sehari; pemeriksa yang sama menolak
  // tanggal yang tidak ada di kalender (mis. 2024-02-31). Pesannya
  // ditulis ulang di sini karena parameternya bernama "tanggal", bukan
  // "dari" — pesan yang menyebut nama parameter yang salah membuat
  // pemanggil mencari-cari medan yang tidak ia kirim.
  const cek = periksaRentangKustom(tanggal, tanggal);
  if (!cek.ok) {
    return NextResponse.json(
      {
        pesan: cek.pesan.replace(
          /Tanggal "(dari|sampai)"/,
          'Parameter "tanggal"',
        ),
      },
      { status: 400 },
    );
  }

  const baris = await laporanGmv(pengguna, tanggal, tanggal);
  const hari = seriHarian(baris)[0] ?? null;

  if (p.get("format") === "csv") {
    const isi = berkasCsv([
      barisCsv(["Rincian GMV harian K-Space V2"]),
      barisCsv(["Tanggal", tanggal]),
      barisCsv(["Disiapkan untuk", pengguna.nama, pengguna.role]),
      "",
      barisCsv(["Pelapor / akun", "Unit", "GMV"]),
      ...(hari?.penyusun ?? []).map((x) =>
        barisCsv([x.label, x.unitId ?? "—", x.gmv]),
      ),
      "",
      barisCsv(["Total", "", hari?.gmv ?? 0]),
    ]);

    return new NextResponse(isi, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="k-space-gmv-${tanggal}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  }

  return NextResponse.json(
    {
      tanggal,
      label: labelTanggal(tanggal),
      // Hari tanpa laporan bukan hari bernilai nol; dibedakan di sini
      // juga, bukan hanya di layar.
      adaLaporan: hari !== null,
      total: hari?.gmv ?? 0,
      target: hari?.target ?? 0,
      jumlahLaporan: hari?.jumlahLaporan ?? 0,
      penyusun: hari?.penyusun ?? [],
      sumber: "Laporan GMV harian yang diisi manual (tabel daily_reports).",
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
