import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LineChart } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Reveal } from "@/components/motion/reveal";
import { PanelMetrik } from "@/components/gmv/panel-metrik";
import { KeadaanKosong } from "@/components/shared/keadaan";
import { RingkasanAngka } from "@/components/gmv/ringkasan-gmv";
import { TitikData } from "@/components/gmv/titik-data";
import { RincianLini } from "@/components/gmv/rincian-lini";
import { CatatanSumber } from "@/components/gmv/catatan-sumber";
import { KerangkaAnalitik } from "@/components/gmv/kerangka-analitik";
import {
  BATAS_RINCI_HARI,
  laporanGmv,
  rekapUnitGmv,
  seriGmvHarian,
  seriUnitHarian,
} from "@/lib/data/gmv";
import {
  bandingkan,
  kelompokkanPerUnit,
  kelompokkanSeri,
  granularitasUntuk,
  metrikGmv,
  selisihHari,
  LABEL_GRANULARITAS,
  potongSepadan,
  ringkasGmv,
  seriDariAgregat,
  seriHarian,
  seriPerUnit,
  totalPerUnit,
} from "@/lib/gmv";
import { PilihRentangPeriode } from "@/components/shared/pilih-rentang-periode";
import {
  bacaJenisPeriode,
  hariDalamRentang,
  rentangPeriode,
  rentangSebelumnya,
  type RentangPeriode,
} from "@/lib/periode-finance";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { modeData } from "@/lib/supabase/config";
import type { Pengguna } from "@/lib/types";

export const metadata: Metadata = {
  title: "Analitik GMV — K-Space V2",
  description: "Tren GMV harian, ringkasan angka, dan rincian titik datanya.",
};

/**
 * Dasbor Analitik GMV (PRD Fase 2).
 *
 * Memperluas kartu "GMV vs Target per Unit Hari Ini" dari satu hari
 * menjadi sebuah garis waktu. Sumbernya tetap `daily_reports` — tidak
 * ada tabel agregat baru, dan karena itu tidak ada angka di sini yang
 * lebih baru daripada laporan terakhir yang masuk.
 */
export default async function GmvPage({ searchParams }: PageProps<"/gmv">) {
  const params = await searchParams;
  const persona = params.persona;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const hariIni =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const satu = (n: string | string[] | undefined) =>
    Array.isArray(n) ? n[0] : n;
  const acuanDiminta = satu(params.acuan);
  const acuan = /^\d{4}-\d{2}-\d{2}$/.test(acuanDiminta ?? "")
    ? acuanDiminta!
    : hariIni;

  // Filter periode dan rentang kustomnya memakai modul yang sama dengan
  // dasbor Finance (lib/periode-finance.ts): "mingguan" harus berarti
  // pekan yang sama persis di kedua dasbor, kalau tidak dua halaman
  // akan menyebut angka berbeda untuk rentang yang orang kira sama.
  const rentang = rentangPeriode(bacaJenisPeriode(params.periode), acuan, {
    dari: satu(params.dari),
    sampai: satu(params.sampai),
  });

  return (
    <AppShell pengguna={pengguna} halaman="Analitik GMV">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="space-y-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Analitik GMV
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Tren GMV harian yang dibaca langsung dari laporan harian. Angkanya
              sekuat disiplin pelaporannya — bukan tarikan otomatis dari TikTok
              atau Shopee.
            </p>
          </div>

          <PilihRentangPeriode rentang={rentang} hariIni={hariIni} />
        </div>

        {/* `key` membuat Suspense menyala lagi setiap kali rentangnya
            berubah; tanpa itu React memakai ulang batas yang sudah
            selesai dan layar diam tanpa tanda apa pun. */}
        <Suspense
          key={`${rentang.dari}:${rentang.sampai}`}
          fallback={<KerangkaAnalitik />}
        >
          <IsiAnalitik
            pengguna={pengguna}
            rentang={rentang}
            hariIni={hariIni}
          />
        </Suspense>
      </div>
    </AppShell>
  );
}

/** Bagian yang benar-benar menunggu data; sisanya tampil seketika. */
async function IsiAnalitik({
  pengguna,
  rentang,
  hariIni,
}: {
  pengguna: Pengguna;
  rentang: RentangPeriode;
  hariIni: string;
}) {
  const penuh = rentangSebelumnya(rentang);
  // Pembandingnya dipotong sepanjang hari yang sudah berjalan: pada
  // tanggal 8, "bulan ini" yang baru 7 hari tidak dibandingkan dengan
  // "bulan lalu" yang 30 hari penuh.
  const sepadan = potongSepadan(penuh, rentang, hariIni);
  const sebelumnya = { ...penuh, dari: sepadan.dari, sampai: sepadan.sampai };
  // Rentang pendek menarik laporannya satu per satu supaya tiap hari
  // bisa dibuka sampai ke pelapornya. Rentang panjang tidak: basis data
  // yang menjumlahkan (RPC gmv_harian, migrasi 0110), dan tabel
  // rinciannya memang sudah terlalu panjang untuk dibaca siapa pun.
  const rinci = hariDalamRentang(rentang) <= BATAS_RINCI_HARI;

  const [
    baris,
    agregat,
    perUnit,
    agregatSebelum,
    unitHarian,
    unitHarianSebelum,
  ] = await Promise.all([
    rinci
      ? laporanGmv(pengguna, rentang.dari, rentang.sampai)
      : Promise.resolve(null),
    rinci
      ? Promise.resolve(null)
      : seriGmvHarian(pengguna, rentang.dari, rentang.sampai),
    rekapUnitGmv(pengguna, rentang.dari, rentang.sampai),
    seriGmvHarian(pengguna, sebelumnya.dari, sebelumnya.sampai),
    seriUnitHarian(pengguna, rentang.dari, rentang.sampai),
    // Pembanding tiap lini. RPC yang sama dengan periode berjalan,
    // jadi "naik/turun" per lini dihitung dari sumber yang sama —
    // bukan ditaksir dari porsinya.
    seriUnitHarian(pengguna, sebelumnya.dari, sebelumnya.sampai),
  ]);

  const titik = baris ? seriHarian(baris) : seriDariAgregat(agregat ?? []);
  // Ringkasan selalu dihitung dari titik HARIAN: "hari terlapor" dan
  // "hari tertinggi" kehilangan artinya kalau dihitung dari pekan.
  const ringkas = ringkasGmv(titik);
  // Grafiknya yang dikasarkan, bukan angkanya — 366 titik pada lebar
  // 300px bukan tren, melainkan pagar.
  const granularitas = granularitasUntuk(hariDalamRentang(rentang));
  const titikGrafik = kelompokkanSeri(titik, granularitas);
  // Garis per lini ikut dikelompokkan dengan kekasaran yang sama:
  // sumbu yang berbeda jumlah titiknya akan menggambar perbandingan
  // yang tidak pernah terjadi.
  const seriLini = seriPerUnit(
    titikGrafik,
    kelompokkanPerUnit(unitHarian, granularitas),
  );
  const ringkasSebelum = ringkasGmv(seriDariAgregat(agregatSebelum));
  const banding = bandingkan(ringkas.total, ringkasSebelum.total);
  // Metrik yang boleh dicentang. Angka besarnya selalu dari periode
  // penuh; yang dikelompokkan hanya titik grafiknya.
  const metrik = metrikGmv({
    titik: titikGrafik,
    seriLini,
    sebelum: {
      gmv: ringkasSebelum.total,
      jumlahLaporan: agregatSebelum.reduce((a, x) => a + x.jumlahLaporan, 0),
    },
    sebelumLini: totalPerUnit(unitHarianSebelum),
  });

  if (titik.length === 0) {
    return (
      <div className="space-y-4">
        <KeadaanKosong
          ikon={<LineChart className="size-4" />}
          judul="Belum ada laporan pada periode ini"
          pesan={`Tidak ada laporan GMV antara ${rentang.dari} dan ${rentang.sampai}. Ganti periode di atas, atau tunggu laporan harian berikutnya masuk.`}
        />
        <CatatanSumber
          hariTerlapor={0}
          hariDalamRentang={hariDalamRentang(rentang)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Reveal>
        <RingkasanAngka
          ringkas={ringkas}
          banding={banding}
          perUnit={perUnit}
          pembanding={{
            label: sepadan.dipotong
              ? `${penuh.label} (sampai hari ke-${selisihHari(sebelumnya.dari, sebelumnya.sampai) + 1})`
              : penuh.label,
            ringkas: ringkasSebelum,
            dipotong: sepadan.dipotong,
          }}
        />
      </Reveal>

      <Reveal>
        <PanelMetrik
          metrik={metrik}
          // "periode lalu", bukan tanggalnya: rentang mingguan ditulis
          // penuh jadi dua baris di tiap kartu, dan rentang persisnya
          // sudah disebut sekali di kartu Ringkasan periode di atas.
          pembanding="periode lalu"
          judulGrafik={`Tren ${LABEL_GRANULARITAS[granularitas]}`}
        />
      </Reveal>

      <Reveal>
        <RincianLini seri={seriLini} total={ringkas.total} />
      </Reveal>

      {rinci ? (
        <Reveal>
          <TitikData titik={titik} />
        </Reveal>
      ) : null}

      <Reveal>
        <CatatanSumber
          hariTerlapor={ringkas.hariTerlapor}
          hariDalamRentang={hariDalamRentang(rentang)}
          tanpaRincian={!rinci}
        />
      </Reveal>
    </div>
  );
}
