import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AksesDitolak } from "@/components/layout/akses-ditolak";
import { JadwalBulanan } from "@/components/depresiasi/jadwal-bulanan";
import { SubMenuFinance } from "@/components/keuangan/sub-menu-finance";
import { Card } from "@/components/ui/card";
import { akumulasiPenyusutan, nilaiBuku, penyusutanPerBulan } from "@/lib/aset";
import { bolehLihatKeuangan } from "@/lib/keuangan";
import { asetDariKode } from "@/lib/data/aset";
import { rupiahPenuh, tanggalPendek } from "@/lib/format";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export async function generateMetadata({
  params,
}: PageProps<"/keuangan/depresiasi/[kode]">): Promise<Metadata> {
  const { kode } = await params;
  return {
    title: `Penyusutan ${decodeURIComponent(kode).toUpperCase()} — K-Space V2`,
    description: "Jadwal penyusutan bulanan satu aset.",
  };
}

function Angka({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="rounded-2xl bg-muted/50 p-3">
      <dt className="text-[11px] leading-[14px] text-muted-foreground">
        {label}
      </dt>
      <dd className="tabular text-[13px] leading-[18px] font-semibold">
        {nilai}
      </dd>
    </div>
  );
}

export default async function JadwalAsetPage({
  params,
  searchParams,
}: PageProps<"/keuangan/depresiasi/[kode]">) {
  const [{ kode }, { persona }] = await Promise.all([params, searchParams]);
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");
  if (!bolehLihatKeuangan(pengguna.role)) {
    return (
      <AksesDitolak
        pengguna={pengguna}
        halaman="Depresiasi Aset"
        siapa="Finance, Manager, dan CEO"
      />
    );
  }

  const aset = await asetDariKode(pengguna, decodeURIComponent(kode));
  if (!aset) notFound();

  const hariIni =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  return (
    <AppShell pengguna={pengguna} halaman="Keuangan">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/keuangan/depresiasi"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Depresiasi
        </Link>

        <SubMenuFinance />

        <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
          <div className="px-5">
            <h1 className="text-[22px] leading-7 font-bold tracking-tight text-pretty">
              {aset.nama}
            </h1>
            <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
              {aset.kode} · {aset.unitNama} · diperoleh{" "}
              {tanggalPendek(aset.tanggal)}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-2 px-5">
            <Angka
              label="Nilai perolehan"
              nilai={rupiahPenuh(aset.nilaiPerolehan)}
            />
            <Angka
              label="Beban per bulan"
              nilai={rupiahPenuh(Math.round(penyusutanPerBulan(aset)))}
            />
            <Angka
              label="Akumulasi hari ini"
              nilai={`−${rupiahPenuh(akumulasiPenyusutan(aset, hariIni))}`}
            />
            <Angka
              label="Nilai buku hari ini"
              nilai={rupiahPenuh(nilaiBuku(aset, hariIni))}
            />
          </dl>

          <p className="px-5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
            <Link href={`/aset/${aset.kode}`} className="hover:underline">
              Lihat kartu asetnya
            </Link>{" "}
            untuk riwayat pemegang dan keadaannya.
          </p>
        </Card>

        <JadwalBulanan aset={aset} periodeBerjalan={hariIni.slice(0, 7)} />
      </div>
    </AppShell>
  );
}
