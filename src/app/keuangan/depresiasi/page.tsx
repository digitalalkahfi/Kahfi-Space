import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DaftarDepresiasi } from "@/components/depresiasi/daftar-depresiasi";
import { DampakDepresiasi } from "@/components/depresiasi/dampak-depresiasi";
import { JadwalPeriode } from "@/components/depresiasi/jadwal-periode";
import { PemisahanStruktur } from "@/components/depresiasi/pemisahan-struktur";
import { RingkasanDepresiasi } from "@/components/depresiasi/ringkasan-depresiasi";
import { PilihPeriodeDepresiasi } from "@/components/depresiasi/pilih-periode";
import { SubMenuFinance } from "@/components/keuangan/sub-menu-finance";
import { CatatanDataContoh } from "@/components/shared/catatan-data-contoh";
import { Reveal } from "@/components/motion/reveal";
import {
  depresiasiPeriode,
  jadwalPerPeriode,
  pengaruhLaba,
  periodeDepresiasi,
  ringkasDepresiasi,
} from "@/lib/depresiasi";
import {
  bolehLihatKeuangan,
  rentangBulan,
  ringkasKeuangan,
} from "@/lib/keuangan";
import { daftarAset } from "@/lib/data/aset";
import { daftarTransaksi, kasAwal } from "@/lib/data/keuangan";
import { bulanPanjang } from "@/lib/format";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Depresiasi Aset — K-Space V2",
  description:
    "Beban penyusutan per periode dan pengaruhnya terhadap laba serta NPM.",
};

export default async function DepresiasiPage({
  searchParams,
}: PageProps<"/keuangan/depresiasi">) {
  const params = await searchParams;
  const pengguna = await sesiSaatIni(
    peranValid(params.persona) ? params.persona : undefined,
  );
  if (!pengguna) redirect("/masuk");

  // Angka perusahaan: hanya Finance, Manager, dan CEO.
  if (!bolehLihatKeuangan(pengguna.role)) notFound();

  const hariIni =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const [aset, transaksi, saldoAwal] = await Promise.all([
    daftarAset(pengguna),
    daftarTransaksi(pengguna),
    kasAwal(),
  ]);

  const tersedia = periodeDepresiasi(aset, hariIni);
  const diminta = Array.isArray(params.periode)
    ? params.periode[0]
    : params.periode;
  const periode =
    diminta && tersedia.includes(diminta)
      ? diminta
      : (tersedia[0] ?? hariIni.slice(0, 7));

  const baris = depresiasiPeriode(aset, periode);

  // Laba periode itu dihitung dari transaksinya sendiri, bukan dari
  // seluruh riwayat: pengaruh penyusutan hanya berarti dalam satu bulan.
  const bulan = rentangBulan(`${periode}-01`);
  const ringkas = ringkasKeuangan(
    transaksi.filter(
      (t) => t.tanggal >= bulan.dari && t.tanggal <= bulan.sampai,
    ),
    saldoAwal,
  );
  const pengaruh = pengaruhLaba(ringkas, ringkasDepresiasi(baris).beban);

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
              Depresiasi aset
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Penyusutan berdiri sendiri, terpisah dari beban operasional dan
              direct cost — supaya laba dan NPM tidak terdistorsi oleh pembelian
              aset yang uangnya sudah lama keluar.
            </p>
          </div>

          <PilihPeriodeDepresiasi periode={periode} tersedia={tersedia} />
        </div>

        <CatatanDataContoh pesan="Register asetnya masih data contoh; beban penyusutannya dihitung dari angka yang sama dengan halaman Aset." />

        <RingkasanDepresiasi
          baris={baris}
          periode={bulanPanjang(`${periode}-01`)}
        />

        <Reveal>
          <DampakDepresiasi pengaruh={pengaruh} />
        </Reveal>

        <Reveal>
          <PemisahanStruktur
            ringkas={ringkas}
            depresiasi={ringkasDepresiasi(baris).beban}
          />
        </Reveal>

        <Reveal>
          <JadwalPeriode
            baris={jadwalPerPeriode(aset, periode)}
            periodeAktif={periode}
          />
        </Reveal>

        <Reveal>
          <DaftarDepresiasi baris={baris} />
        </Reveal>
      </div>
    </AppShell>
  );
}
