import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CatatanDataContoh } from "@/components/shared/catatan-data-contoh";
import { BandingWaterfall } from "@/components/keuangan/banding-waterfall";
import { KontribusiUnitKartu } from "@/components/keuangan/kontribusi-unit";
import { SubMenuFinance } from "@/components/keuangan/sub-menu-finance";
import { Reveal } from "@/components/motion/reveal";
import { daftarTransaksi, kasAwal } from "@/lib/data/keuangan";
import {
  bacaSaringanTransaksi,
  bolehLihatKeuangan,
  kontribusiUnit,
  periodeSebelumnya,
  rentangBulan,
  ringkasKeuangan,
  saringTransaksi,
} from "@/lib/keuangan";
import { tanggalPendek } from "@/lib/format";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Waterfall Manajemen — K-Space V2",
  description:
    "Dari pendapatan turun ke laba bersih, dibandingkan periode sebelumnya.",
};

export default async function WaterfallPage({
  searchParams,
}: PageProps<"/keuangan/waterfall">) {
  const params = await searchParams;
  const pengguna = await sesiSaatIni(
    peranValid(params.persona) ? params.persona : undefined,
  );
  if (!pengguna) redirect("/masuk");
  if (!bolehLihatKeuangan(pengguna.role)) notFound();

  const hariIni =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const bawaan = rentangBulan(hariIni);
  const dibaca = bacaSaringanTransaksi(params);
  const dari = dibaca.dari || bawaan.dari;
  const sampai = dibaca.sampai || bawaan.sampai;
  const lalu = periodeSebelumnya(dari, sampai);

  const semua = await daftarTransaksi(pengguna);
  const periode = saringTransaksi(semua, { ...dibaca, dari, sampai });
  const pembanding = saringTransaksi(semua, {
    ...dibaca,
    dari: lalu.dari,
    sampai: lalu.sampai,
  });

  const sebelumPeriode = semua.filter((t) => t.tanggal < dari);
  const saldoAwal = ringkasKeuangan(sebelumPeriode, await kasAwal()).saldoKas;

  const ringkas = ringkasKeuangan(periode, saldoAwal);
  const ringkasLalu = ringkasKeuangan(pembanding);

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

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Waterfall manajemen
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {tanggalPendek(dari)} – {tanggalPendek(sampai)} · {periode.length}{" "}
            transaksi
          </p>
        </div>

        <CatatanDataContoh />

        <Reveal>
          <BandingWaterfall
            sekarang={ringkas}
            sebelumnya={ringkasLalu}
            labelPembanding={`${tanggalPendek(lalu.dari)} – ${tanggalPendek(lalu.sampai)}`}
          />
        </Reveal>

        <Reveal>
          <KontribusiUnitKartu daftar={kontribusiUnit(periode)} />
        </Reveal>
      </div>
    </AppShell>
  );
}
