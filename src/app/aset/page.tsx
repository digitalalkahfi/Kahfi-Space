import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DaftarAset } from "@/components/aset/daftar-aset";
import { DialogTambahAset } from "@/components/aset/dialog-aset";
import { NilaiAset } from "@/components/aset/nilai-aset";
import { RingkasanAset } from "@/components/aset/ringkasan-aset";
import { SaringAset } from "@/components/aset/saring-aset";
import { TabInventaris } from "@/components/shared/tab-inventaris";
import { CatatanDataContoh } from "@/components/shared/catatan-data-contoh";
import { SubMenuFinance } from "@/components/keuangan/sub-menu-finance";
import { Reveal } from "@/components/motion/reveal";
import {
  bolehKelolaAset,
  bolehLihatNilaiAset,
  daftarAset,
  kodeBerikutnya,
} from "@/lib/data/aset";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { asetTersaring, bacaSaringanAset, saringAset } from "@/lib/aset";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Aset & Inventaris — K-Space V2",
  description:
    "Aset perusahaan beserta pemegang, lokasi, keadaan, dan nilai bukunya.",
};

export default async function AsetPage({ searchParams }: PageProps<"/aset">) {
  const params = await searchParams;
  const pengguna = await sesiSaatIni(
    peranValid(params.persona) ? params.persona : undefined,
  );
  if (!pengguna) redirect("/masuk");

  const hariIni =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const bolehKelola = bolehKelolaAset(pengguna);
  const [semua, pilihan, kodeAsetBaru] = await Promise.all([
    daftarAset(pengguna),
    pilihanOrganisasi(),
    kodeBerikutnya(),
  ]);
  const saringan = bacaSaringanAset(params);
  const tersaring = saringAset(semua, saringan);

  const unit = [...new Set(semua.map((a) => a.unitNama))].sort();
  const kategori = [...new Set(semua.map((a) => a.kategori))].sort();
  const bolehNilai = bolehLihatNilaiAset(pengguna);

  return (
    <AppShell pengguna={pengguna} halaman="Aset">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <SubMenuFinance />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Aset & inventaris
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Barang yang dibeli lewat transaksi berjenis aset. Yang dicatat
              bukan hanya harganya, tetapi siapa memegangnya dan nilainya
              tinggal berapa.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/aset/riwayat"
              className="tekan-halus sentuh-nyaman inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-4 text-[11px] leading-[18px] font-semibold ring-1 ring-border-subtle"
            >
              <History className="size-3.5" />
              Log perubahan
            </Link>

            {bolehKelola ? (
              <DialogTambahAset
                pilihan={pilihan}
                kodeBerikutnya={kodeAsetBaru}
                tanggalBawaan={hariIni}
              />
            ) : null}
          </div>
        </div>

        <TabInventaris />

        <CatatanDataContoh pesan="Register aset ini berasal dari data contoh; mode demo tidak menyimpan apa pun." />

        <RingkasanAset
          daftar={semua}
          sampai={hariIni}
          bolehLihatNilai={bolehNilai}
        />

        {bolehNilai ? (
          <Reveal>
            <NilaiAset daftar={semua} sampai={hariIni} />
          </Reveal>
        ) : null}

        <SaringAset
          saringan={saringan}
          unit={unit}
          kategori={kategori}
          jumlah={tersaring.length}
          total={semua.length}
        />

        <Reveal>
          <DaftarAset
            daftar={tersaring}
            sampai={hariIni}
            bolehLihatNilai={bolehNilai}
            judul={asetTersaring(saringan) ? "Aset tersaring" : "Seluruh aset"}
          />
        </Reveal>

        {bolehKelola ? null : (
          <p className="px-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
            Perubahan pemegang dan keadaan aset dicatat oleh Finance, Manager,
            atau CEO.
          </p>
        )}
      </div>
    </AppShell>
  );
}
