import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Reveal } from "@/components/motion/reveal";
import { PilihRentangPeriode } from "@/components/shared/pilih-rentang-periode";
import { TabelAkunAffiliator } from "@/components/gmv/tabel-akun-affiliator";
import { detailAkunAffiliator } from "@/lib/data/akun-affiliator";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { bolehLihatKomisiSemua } from "@/lib/komisi";
import { bacaRentangGmv, rentangPembanding } from "@/lib/gmv";
import { denganPembanding } from "@/lib/akun-affiliator";
import { tanggalDataTerakhir } from "@/lib/laporan";
import { hariIniWib } from "@/lib/format";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Detail Akun Affiliator — K-Space V2",
  description:
    "GMV, komisi, upload, dan kepatuhan setiap akun Affiliator per periode.",
};

/**
 * Detail per akun Affiliator (docs/KOMISI-DETAIL-AKUN-AFFILIATOR.md §4.4).
 *
 * Hanya CEO dan Manager. Peran lain dialihkan kembali ke dasbor GMV
 * SEBELUM data apa pun dimuat, jadi tidak ada angka per akun maupun
 * komisi yang sampai ke browser mereka (AC4). Periodenya mengikuti
 * pilihan di dasbor GMV — parameter URL yang sama.
 */
export default async function AkunAffiliatorPage({
  searchParams,
}: PageProps<"/gmv/affiliator">) {
  const params = await searchParams;
  const pengguna = await sesiSaatIni(
    peranValid(params.persona) ? params.persona : undefined,
  );
  if (!pengguna) redirect("/masuk");
  if (!bolehLihatKomisiSemua(pengguna.role)) redirect("/gmv");

  const hariIni = tanggalDataTerakhir(
    modeData() === "demo" ? TANGGAL_ACUAN : hariIniWib(),
  );
  const rentang = bacaRentangGmv(params, hariIni);
  // Pembanding naik/turun: definisi yang sama dengan kartu Metrik utama
  // di dasbor GMV (docs/DETAIL-PER-AKUN-GRAFIK.md §4).
  const pembanding = rentangPembanding(rentang, hariIni);
  const [sekarang, sebelum] = await Promise.all([
    detailAkunAffiliator(pengguna, rentang.dari, rentang.sampai),
    detailAkunAffiliator(pengguna, pembanding.dari, pembanding.sampai),
  ]);
  const baris = denganPembanding(sekarang ?? [], sebelum ?? []);

  // Kembali ke dasbor dengan periode yang sama.
  const kembali = new URLSearchParams();
  for (const k of ["periode", "acuan", "dari", "sampai", "persona"]) {
    const v = params[k];
    if (typeof v === "string") kembali.set(k, v);
  }
  const tautanKembali = kembali.size > 0 ? `/gmv?${kembali}` : "/gmv";

  return (
    <AppShell pengguna={pengguna} halaman="Analitik GMV">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Link
          href={tautanKembali}
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Analitik GMV
        </Link>

        <div className="space-y-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Detail akun Affiliator
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Angka dihitung per akun, bukan per orang. Akun aktif yang belum
              melapor di periode ini tetap tampil dan ditandai. Komisi hanya
              terlihat oleh CEO dan Manager.
            </p>
          </div>
          <PilihRentangPeriode rentang={rentang} hariIni={hariIni} />
        </div>

        <Reveal>
          <TabelAkunAffiliator
            baris={baris}
            pembanding={
              pembanding.dipotong
                ? `${pembanding.penuh.label} (sepadan)`
                : pembanding.penuh.label
            }
            kueriPeriode={kembali.toString()}
          />
        </Reveal>
      </div>
    </AppShell>
  );
}
