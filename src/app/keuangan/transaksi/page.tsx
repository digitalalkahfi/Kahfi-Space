import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DaftarTransaksi } from "@/components/keuangan/daftar-transaksi";
import { DialogTransaksi } from "@/components/keuangan/dialog-transaksi";
import { PanelPembayaran } from "@/components/keuangan/panel-pembayaran";
import { PanelPersetujuan } from "@/components/keuangan/panel-persetujuan";
import { SaringTransaksi } from "@/components/keuangan/saring-transaksi";
import { SubMenuFinance } from "@/components/keuangan/sub-menu-finance";
import { UnduhTransaksi } from "@/components/keuangan/unduh-transaksi";
import { CatatanDataContoh } from "@/components/shared/catatan-data-contoh";
import { Reveal } from "@/components/motion/reveal";
import { daftarTransaksi, kasAwal } from "@/lib/data/keuangan";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import {
  bacaSaringanTransaksi,
  bolehLihatKeuangan,
  izinPersetujuan,
  penyetujuiWajib,
  ringkasKeuangan,
  saringTransaksi,
  transaksiTersaring,
} from "@/lib/keuangan";
import { bacaKembali } from "@/lib/drill-down";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Transaksi — K-Space V2",
  description:
    "Seluruh transaksi kas beserta antrean persetujuan dan pembayarannya.",
};

/**
 * Daftar transaksi, terpisah dari dasbor Finance (PRD Fase 1).
 *
 * Dasbor menjawab "posisi kita di mana"; halaman ini menjawab "apa saja
 * yang terjadi". Memisahkannya membuat keduanya bisa dibaca tanpa
 * menggulir melewati yang lain.
 */
export default async function TransaksiPage({
  searchParams,
}: PageProps<"/keuangan/transaksi">) {
  const params = await searchParams;
  const { persona } = params;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  // Angka perusahaan: hanya Finance, Manager, dan CEO.
  if (!bolehLihatKeuangan(pengguna.role)) notFound();

  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const [transaksi, pilihan, saldoAwal] = await Promise.all([
    daftarTransaksi(pengguna),
    pilihanOrganisasi(),
    kasAwal(),
  ]);

  // Posisi kas dipakai aturan persetujuan (PRD §4), jadi tetap dihitung
  // dari seluruh transaksi — bukan dari hasil saringan.
  const ringkas = ringkasKeuangan(transaksi, saldoAwal);
  const menunggu = transaksi.filter((t) => t.status === "diajukan");
  const belumDibayar = transaksi.filter((t) => t.status === "disetujui");

  const saringan = bacaSaringanTransaksi(params);
  const tersaring = saringTransaksi(transaksi, saringan);
  const unit = [...new Set(transaksi.map((t) => t.unitNama))].sort();

  return (
    <AppShell pengguna={pengguna} halaman="Keuangan">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href={`/keuangan${bacaKembali(params.kembali)}`}
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Keuangan
        </Link>

        <SubMenuFinance />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Transaksi
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Pengajuan, persetujuan, dan pembayaran — semuanya meninggalkan
              jejak yang tidak bisa disunting.
            </p>
          </div>

          <DialogTransaksi
            pilihan={pilihan}
            saldoKas={ringkas.saldoKas}
            tanggalBawaan={tanggal}
          />
        </div>

        <CatatanDataContoh />

        {menunggu.length > 0 ? (
          <Reveal>
            <PanelPersetujuan
              daftar={menunggu}
              izin={izinPersetujuan(
                pengguna.role,
                pengguna.id,
                null,
                ringkas.saldoKas,
              )}
              penyetuju={penyetujuiWajib(ringkas.saldoKas)}
              penggunaId={pengguna.id}
              peran={pengguna.role}
              saldoKas={ringkas.saldoKas}
            />
          </Reveal>
        ) : null}

        {belumDibayar.length > 0 ? (
          <Reveal>
            <PanelPembayaran
              daftar={belumDibayar}
              bolehBayar={bolehLihatKeuangan(pengguna.role)}
            />
          </Reveal>
        ) : null}

        <SaringTransaksi
          saringan={saringan}
          unit={unit}
          jumlah={tersaring.length}
          total={transaksi.length}
        />

        <UnduhTransaksi daftar={tersaring} periode={tanggal.slice(0, 7)} />

        <Reveal>
          <DaftarTransaksi
            daftar={tersaring}
            pilihan={pilihan}
            saldoKas={ringkas.saldoKas}
            judul={
              transaksiTersaring(saringan)
                ? "Transaksi tersaring"
                : "Seluruh transaksi"
            }
          />
        </Reveal>
      </div>
    </AppShell>
  );
}
