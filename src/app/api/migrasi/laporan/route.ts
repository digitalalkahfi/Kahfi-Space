import { NextResponse } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import {
  bolehMigrasi,
  hitunganPeta,
  isiEksporLama,
  orangPending,
  persetujuanPemetaan,
  ringkasJalanKelompok,
  riwayatMigrasi,
} from "@/lib/data/migrasi";
import { bandingV1V2 } from "@/lib/data/banding";
import {
  ENTITAS_TAHAP_2,
  jumlahSelisih,
  jumlahTerhitung,
  nilaiBanding,
} from "@/lib/banding";
import { PEMETAAN_V1 } from "@/lib/pemetaan-v1";
import { versiPemetaan } from "@/lib/pemetaan";
import { rekapPemetaan, totalRekap } from "@/lib/rekap-pemetaan";

/**
 * Seluruh keadaan migrasi dalam satu jawaban.
 *
 * Tiga jalur sebelumnya menjawab satu pertanyaan masing-masing: berapa
 * yang ada, siapa yang menunggu, dan apakah angkanya bertemu. Yang
 * dibutuhkan saat migrasi sungguhan dijalankan adalah ketiganya pada
 * saat yang sama — kalau diambil terpisah, ketiganya menggambarkan tiga
 * keadaan yang berbeda, dan itu bukan bukti apa pun.
 *
 * Inilah yang disimpan sebelum dan sesudah migrasi untuk dibandingkan.
 */
export async function GET() {
  const pengguna = await sesiSaatIni();
  if (!pengguna || !bolehMigrasi(pengguna)) {
    return NextResponse.json(
      { pesan: "Hanya CEO atau Manager yang boleh membaca laporan migrasi." },
      { status: 403 },
    );
  }

  const [isi, dipindahkan, menunggu, persetujuan, banding, riwayat, jalan] =
    await Promise.all([
      isiEksporLama(),
      hitunganPeta(),
      orangPending(),
      persetujuanPemetaan(),
      bandingV1V2(),
      riwayatMigrasi(),
      ringkasJalanKelompok(),
    ]);

  const rekap = rekapPemetaan(isi, PEMETAAN_V1, dipindahkan);
  const total = totalRekap(rekap);
  const belumTertaut = menunggu.filter((o) => !o.userId && !o.diabaikan);

  const disetujui = PEMETAAN_V1.filter((p) =>
    persetujuan.some(
      (s) => s.entitas === p.kunci && s.versi === versiPemetaan(p),
    ),
  );

  return NextResponse.json(
    {
      diambilPada: new Date().toISOString(),
      kesiapan: {
        kelompokDisetujui: disetujui.length,
        kelompokSeluruhnya: PEMETAAN_V1.length,
        orangMenunggu: belumTertaut.length,
        catatanMenggantung: belumTertaut.reduce((a, o) => a + o.jumlah, 0),
        // Yang menentukan boleh atau tidaknya, disebut sebagai satu
        // jawaban supaya tidak perlu disimpulkan ulang di luar.
        bolehDijalankan:
          disetujui.length === PEMETAAN_V1.length && belumTertaut.length === 0,
      },
      rekap: {
        total: {
          ekspor: total.ekspor,
          terpetakan: total.terpetakan,
          butuhKeputusan: total.butuhKeputusan,
          dipindahkan: total.dipindahkan,
        },
        kelompok: rekap.map((r) => ({
          kunci: r.kunci,
          label: r.label,
          ekspor: r.ekspor,
          terpetakan: r.terpetakan,
          butuhKeputusan: r.butuhKeputusan,
          dipindahkan: r.dipindahkan,
        })),
      },
      jalanTerakhir: riwayat[0]
        ? {
            id: riwayat[0].id,
            tahap: riwayat[0].tahap,
            dimulaiPada: riwayat[0].dimulaiPada,
            selesaiPada: riwayat[0].selesaiPada,
            oleh: riwayat[0].olehNama,
            kelompok: jalan,
          }
        : null,
      verifikasi: {
        terhitung: jumlahTerhitung(banding),
        berselisih: jumlahSelisih(banding),
        kelompok: banding.map((k) => ({
          kunci: k.kunci,
          judul: k.judul,
          baris: k.baris.map((b) => {
            const n = nilaiBanding(b);
            return {
              ukuran: b.ukuran,
              satuan: b.satuan,
              v1: b.v1,
              v2: b.v2,
              selisih: n.selisih,
              arah: n.arah,
              status: n.status,
            };
          }),
        })),
      },
      belumDimigrasi: ENTITAS_TAHAP_2,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
