import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileDown } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AksesDitolak } from "@/components/layout/akses-ditolak";
import { CatatanDataContoh } from "@/components/shared/catatan-data-contoh";
import { TabelLaporan } from "@/components/keuangan/tabel-laporan";
import { Waterfall } from "@/components/keuangan/waterfall";
import { TombolUnduhLaporan } from "@/components/keuangan/tombol-unduh-laporan";
import { SubMenuFinance } from "@/components/keuangan/sub-menu-finance";
import { Reveal } from "@/components/motion/reveal";
import { daftarTransaksi, kasAwal } from "@/lib/data/keuangan";
import {
  bacaSaringanTransaksi,
  bolehLihatKeuangan,
  laporanCashFlow,
  laporanLabaRugi,
  rentangBulan,
  ringkasKeuangan,
  saringTransaksi,
} from "@/lib/keuangan";
import { bulanPanjang, tanggalPendek } from "@/lib/format";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Laporan Keuangan — K-Space V2",
  description: "Cash flow, laba rugi, dan waterfall manajemen satu periode.",
};

export default async function LaporanKeuanganPage({
  searchParams,
}: PageProps<"/keuangan/laporan">) {
  const params = await searchParams;
  const pengguna = await sesiSaatIni(
    peranValid(params.persona) ? params.persona : undefined,
  );
  if (!pengguna) redirect("/masuk");
  if (!bolehLihatKeuangan(pengguna.role)) {
    return (
      <AksesDitolak
        pengguna={pengguna}
        halaman="Laporan Keuangan"
        siapa="Finance, Manager, dan CEO"
      />
    );
  }

  const hariIni =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  // Laporan selalu punya periode: tanpa rentang, angkanya tidak berarti.
  // Bawaannya bulan berjalan.
  const bawaan = rentangBulan(hariIni);
  const dibaca = bacaSaringanTransaksi(params);
  const saringan = {
    ...dibaca,
    dari: dibaca.dari || bawaan.dari,
    sampai: dibaca.sampai || bawaan.sampai,
  };

  const semua = await daftarTransaksi(pengguna);
  const periode = saringTransaksi(semua, saringan);

  // Saldo awal periode = kas awal data contoh + seluruh mutasi sebelum
  // tanggal mulainya. Tanpa itu, "saldo kas awal" akan berbohong.
  const sebelumnya = semua.filter((t) => t.tanggal < saringan.dari);
  const saldoAwal = ringkasKeuangan(sebelumnya, await kasAwal()).saldoKas;

  const ringkas = ringkasKeuangan(periode, saldoAwal);
  const cashFlow = laporanCashFlow(ringkas, saldoAwal);
  const labaRugi = laporanLabaRugi(ringkas);

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
              Laporan {bulanPanjang(saringan.dari)}
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              {tanggalPendek(saringan.dari)} – {tanggalPendek(saringan.sampai)}{" "}
              · {periode.length} transaksi
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <TombolUnduhLaporan
              cashFlow={cashFlow}
              labaRugi={labaRugi}
              periode={saringan.dari.slice(0, 7)}
            />

            {/* CSV lewat endpoint: bisa ditarik tautan, skrip, atau
                lembar kerja yang menyegarkan dirinya sendiri. */}
            <a
              href={`/api/keuangan/laporan?dari=${saringan.dari}&sampai=${saringan.sampai}`}
              className="tekan-halus sentuh-nyaman inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-4 text-[11px] leading-[18px] font-semibold ring-1 ring-border-subtle"
            >
              <FileDown className="size-3.5" />
              CSV
            </a>
          </div>
        </div>

        <CatatanDataContoh pesan="Angka laporan ini berasal dari data contoh; mode demo tidak menyimpan apa pun." />

        <Reveal>
          <TabelLaporan
            judul="Arus kas"
            keterangan="Uangnya dari mana dan ke mana — bukan untung berapa."
            baris={cashFlow}
          />
        </Reveal>

        <Reveal>
          <TabelLaporan
            judul="Laba rugi"
            keterangan="Aset dan dividen tidak muncul di sini: keduanya bukan biaya."
            baris={labaRugi}
          />
        </Reveal>

        <Reveal>
          <Waterfall ringkas={ringkas} />
        </Reveal>
      </div>
    </AppShell>
  );
}
