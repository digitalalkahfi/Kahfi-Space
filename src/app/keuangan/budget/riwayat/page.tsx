import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AksesDitolak } from "@/components/layout/akses-ditolak";
import { Reveal } from "@/components/motion/reveal";
import {
  DeretPeristiwa,
  RingkasanPeriode,
} from "@/components/budget/riwayat-anggaran";
import { DialogAlokasi } from "@/components/budget/dialog-alokasi";
import { DialogTambahAnggaran } from "@/components/budget/dialog-anggaran";
import { CatatanDataContoh } from "@/components/shared/catatan-data-contoh";
import { bolehLihatKeuangan } from "@/lib/keuangan";
import { daftarAlokasi, daftarAnggaran } from "@/lib/data/budget";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { riwayatAnggaran, ringkasPeriode } from "@/lib/riwayat-anggaran";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Riwayat Pagu & Alokasi — K-Space V2",
  description:
    "Urutan penetapan pagu dan keputusan alokasi tambahan tiap pos anggaran.",
};

/**
 * Riwayat pagu & alokasi.
 *
 * Halaman Budget menjawab "berapa pagunya sekarang"; halaman ini
 * menjawab "kenapa segitu". Keduanya dipisah karena yang pertama dibuka
 * tiap hari dan yang kedua hanya saat ada yang dipertanyakan — dan
 * menggabungkannya membuat yang harian ikut panjang.
 */
export default async function RiwayatBudgetPage({
  searchParams,
}: PageProps<"/keuangan/budget/riwayat">) {
  const params = await searchParams;
  const pengguna = await sesiSaatIni(
    peranValid(params.persona) ? params.persona : undefined,
  );
  if (!pengguna) redirect("/masuk");

  // Angka perusahaan: hanya Finance, Manager, dan CEO.
  if (!bolehLihatKeuangan(pengguna.role)) {
    return (
      <AksesDitolak
        pengguna={pengguna}
        halaman="Riwayat pagu & alokasi"
        siapa="Finance, Manager, dan CEO"
      />
    );
  }

  const [anggaran, alokasi, pilihan] = await Promise.all([
    daftarAnggaran(pengguna),
    daftarAlokasi(pengguna),
    pilihanOrganisasi(),
  ]);

  const peristiwa = riwayatAnggaran(anggaran, alokasi);
  const ringkas = ringkasPeriode(anggaran, alokasi);

  // Periode bawaan form: bulan berjalan, bukan periode terbaru yang ada
  // di riwayat — pagu baru hampir selalu untuk bulan ini, dan bulan yang
  // salah terisi diam-diam adalah kesalahan yang baru ketahuan saat
  // realisasinya tidak cocok.
  const periodeBawaan = (
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10)
  ).slice(0, 7);

  return (
    <AppShell pengguna={pengguna} halaman="Keuangan">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/keuangan/budget"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Budget
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Riwayat pagu &amp; alokasi
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Urutan penetapan pagu dan keputusan alokasi tambahan, beserta
              alasan dan siapa yang memutuskan.
            </p>
          </div>

          {/* Pengajuan dibuka dari sini juga: yang membaca riwayat justru
              orang yang sedang menimbang pagu berikutnya. */}
          <div className="flex flex-wrap items-center gap-2">
            <DialogAlokasi
              pilihan={pilihan}
              periodeBawaan={periodeBawaan}
              unitBawaan={pengguna.unitId}
            />
            <DialogTambahAnggaran
              pilihan={pilihan}
              periodeBawaan={periodeBawaan}
            />
          </div>
        </div>

        <CatatanDataContoh pesan="Mode demo: riwayat ini dari data contoh, dan pengajuan baru tidak tersimpan." />

        <Reveal>
          <RingkasanPeriode baris={ringkas} />
        </Reveal>

        <Reveal>
          <DeretPeristiwa baris={peristiwa} />
        </Reveal>
      </div>
    </AppShell>
  );
}
