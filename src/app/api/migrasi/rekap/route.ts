import { NextResponse } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import {
  bolehMigrasi,
  hitunganPeta,
  isiEksporLama,
  ringkasJalanKelompok,
  type RingkasKelompokJalan,
} from "@/lib/data/migrasi";
import { PEMETAAN_V1 } from "@/lib/pemetaan-v1";
import { orangDitunggu, rekapPemetaan, totalRekap } from "@/lib/rekap-pemetaan";

/**
 * Hitungan pemetaan per kelompok, dalam bentuk yang bisa dibaca alat lain.
 *
 * Layar sudah menampilkannya, tetapi angka ini juga dipakai di luar
 * layar: memeriksa kesiapan sebelum migrasi dijalankan, dan membandingkan
 * keadaan sebelum dan sesudah. Menyalinnya dengan tangan dari layar
 * adalah cara paling mudah salah hitung.
 *
 * Perannya sama dengan layar migrasinya — isinya menyangkut data pribadi
 * seluruh karyawan lama, jadi tidak ada pintu yang lebih longgar.
 */
export async function GET() {
  const pengguna = await sesiSaatIni();
  if (!pengguna || !bolehMigrasi(pengguna)) {
    return NextResponse.json(
      { pesan: "Hanya CEO atau Manager yang boleh membaca rekap migrasi." },
      { status: 403 },
    );
  }

  const [isi, dipindahkan, jalanTerakhir] = await Promise.all([
    isiEksporLama(),
    hitunganPeta(),
    ringkasJalanKelompok(),
  ]);

  // Dua pertanyaan yang berbeda dan sering dikira sama: apa yang ADA di
  // ekspor, dan apa yang benar-benar PINDAH. Keduanya dijawab terpisah.
  const hasilJalan = new Map<string, RingkasKelompokJalan>(
    jalanTerakhir.map((r) => [r.kelompok, r]),
  );

  const baris = rekapPemetaan(isi, PEMETAAN_V1, dipindahkan);
  const total = totalRekap(baris);
  const menunggu = orangDitunggu(isi, PEMETAAN_V1);

  return NextResponse.json(
    {
      total: {
        ekspor: total.ekspor,
        terpetakan: total.terpetakan,
        butuhKeputusan: total.butuhKeputusan,
        dipindahkan: total.dipindahkan,
      },
      kelompok: baris.map((b) => {
        const jalan = hasilJalan.get(b.kunci);
        return {
          kunci: b.kunci,
          label: b.label,
          ekspor: b.ekspor,
          terpetakan: b.terpetakan,
          butuhKeputusan: b.butuhKeputusan,
          dipindahkan: b.dipindahkan,
          // Hasil jalan terakhir; null bila kelompok ini belum pernah
          // ikut dijalankan.
          jalanTerakhir: jalan
            ? {
                diperiksa: jalan.diperiksa,
                ditulis: jalan.ditulis,
                tertahan: jalan.tertahan,
              }
            : null,
        };
      }),
      // Id orang saja, tanpa namanya: ini rekap angka, bukan daftar orang.
      orangMenunggu: menunggu.map((o) => ({
        idLama: o.idLama,
        kemunculan: o.kemunculan,
        jumlah: o.jumlah,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
