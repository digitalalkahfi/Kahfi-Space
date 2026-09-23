import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AksesDitolak } from "@/components/layout/akses-ditolak";
import { BandingRealisasi } from "@/components/budget/banding-realisasi";
import { DaftarAnggaran } from "@/components/budget/daftar-anggaran";
import { DaftarAlokasi } from "@/components/budget/daftar-alokasi";
import { DialogAlokasi } from "@/components/budget/dialog-alokasi";
import { DialogTambahAnggaran } from "@/components/budget/dialog-anggaran";
import { RingkasanAnggaran } from "@/components/budget/ringkasan-anggaran";
import { TabelDivisi } from "@/components/budget/tabel-divisi";
import { SaringAnggaran } from "@/components/budget/saring-anggaran";
import { CatatanDataContoh } from "@/components/shared/catatan-data-contoh";
import { SubMenuFinance } from "@/components/keuangan/sub-menu-finance";
import { Reveal } from "@/components/motion/reveal";
import {
  bacaSaringanAnggaran,
  bandingPeriode,
  periodeAnggaran,
  realisasiAnggaran,
  saringAnggaran,
} from "@/lib/budget";
import { bolehLihatKeuangan } from "@/lib/keuangan";
import { daftarAlokasi, daftarAnggaran } from "@/lib/data/budget";
import { daftarTransaksi } from "@/lib/data/keuangan";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { bulanPanjang } from "@/lib/format";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Budget — K-Space V2",
  description:
    "Anggaran per unit dan jenis pengeluaran, disandingkan dengan realisasinya.",
};

export default async function BudgetPage({
  searchParams,
}: PageProps<"/keuangan/budget">) {
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
        halaman="Budget"
        siapa="Finance, Manager, dan CEO"
      />
    );
  }

  const [anggaran, alokasi, transaksi, pilihan] = await Promise.all([
    daftarAnggaran(pengguna),
    daftarAlokasi(pengguna),
    daftarTransaksi(pengguna),
    pilihanOrganisasi(),
  ]);

  const hariIni =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const tersedia = periodeAnggaran(anggaran);
  const bawaan =
    tersedia.find((p) => p <= hariIni.slice(0, 7)) ??
    tersedia[0] ??
    hariIni.slice(0, 7);

  const saringan = bacaSaringanAnggaran(params, tersedia, bawaan);
  const periode = saringan.periode;
  const unit = [...new Set(anggaran.map((a) => a.unitNama))].sort();

  const dalamPeriode = anggaran.filter((a) => a.periode === periode);
  const baris = realisasiAnggaran(
    saringAnggaran(anggaran, saringan),
    transaksi,
  );

  // Pembanding: periode terdekat sebelum yang sedang dibuka, dengan
  // saringan divisi yang sama supaya angkanya setara.
  const periodeSebelumnya = tersedia.filter((p) => p < periode).at(0) ?? null;
  const banding = bandingPeriode(
    baris,
    periodeSebelumnya
      ? realisasiAnggaran(
          saringAnggaran(anggaran, {
            ...saringan,
            periode: periodeSebelumnya,
          }),
          transaksi,
        )
      : [],
    periodeSebelumnya,
  );

  return (
    <AppShell pengguna={pengguna} halaman="Keuangan">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/keuangan"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Keuangan
        </Link>

        <SubMenuFinance />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Budget {bulanPanjang(`${periode}-01`)}
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Pagu ditetapkan per unit dan jenis pengeluaran; realisasinya
              diambil dari transaksi yang sudah dibayar — tidak dicatat dua
              kali.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/keuangan/budget/riwayat"
              className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
            >
              <History className="size-3.5" />
              Riwayat pagu
            </Link>
            <DialogAlokasi
              pilihan={pilihan}
              periodeBawaan={periode}
              unitBawaan={pengguna.unitId}
            />
            <DialogTambahAnggaran pilihan={pilihan} periodeBawaan={periode} />
          </div>
        </div>

        <CatatanDataContoh pesan="Mode demo: pagu dan pengajuan alokasi diperiksa, tetapi tidak tersimpan. Realisasinya dihitung dari transaksi contoh." />

        <SaringAnggaran
          saringan={saringan}
          periode={tersedia}
          unit={unit}
          jumlah={baris.length}
          total={dalamPeriode.length}
        />

        <RingkasanAnggaran
          baris={baris}
          periode={bulanPanjang(`${periode}-01`)}
          banding={banding}
        />

        <Reveal>
          <DaftarAlokasi
            daftar={alokasi.filter(
              (a) =>
                a.periode === periode &&
                (saringan.unit === "semua" || a.unitNama === saringan.unit),
            )}
            peran={pengguna.role}
            namaSaya={pengguna.nama}
          />
        </Reveal>

        <Reveal>
          <BandingRealisasi baris={baris} />
        </Reveal>

        <Reveal>
          <TabelDivisi
            anggaran={anggaran}
            transaksi={transaksi}
            periode={tersedia}
          />
        </Reveal>

        <Reveal>
          <DaftarAnggaran baris={baris} pilihan={pilihan} bolehKelola />
        </Reveal>
      </div>
    </AppShell>
  );
}
