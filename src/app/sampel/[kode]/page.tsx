import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Package, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { AksiPerpindahan } from "@/components/sampel/aksi-perpindahan";
import { KartuProduk } from "@/components/sampel/kartu-produk";
import { PerjalananSampel } from "@/components/sampel/perjalanan-sampel";
import { KartuQr } from "@/components/sampel/kartu-qr";
import { RiwayatSampel } from "@/components/sampel/riwayat-sampel";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { rupiahPenuh } from "@/lib/format";
import { GAYA_STATUS_SAMPEL, LABEL_STATUS_SAMPEL } from "@/lib/sampel";
import {
  bolehKelolaSampel,
  riwayatSampel,
  sampelDariKode,
} from "@/lib/data/sampel";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { daftarAnggota, peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export async function generateMetadata({
  params,
}: PageProps<"/sampel/[kode]">): Promise<Metadata> {
  const { kode } = await params;
  return {
    title: `${decodeURIComponent(kode)} — Sampel K-Space V2`,
    description: "Keadaan, riwayat perpindahan, dan stiker QR sampel.",
  };
}

export default async function DetailSampelPage({
  params,
  searchParams,
}: PageProps<"/sampel/[kode]">) {
  const [{ kode }, { persona }] = await Promise.all([params, searchParams]);
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const sampel = await sampelDariKode(pengguna, decodeURIComponent(kode));
  // Sampel di luar cakupannya memang tidak ada baginya.
  if (!sampel) notFound();

  // Mode demo berjalan pada tanggal acuan data contoh, bukan hari ini.
  const acuan =
    modeData() === "demo"
      ? `${TANGGAL_ACUAN}T12:00:00+07:00`
      : new Date().toISOString();

  // Mengganti tautan produk mengikuti pagar yang sama dengan menyunting
  // sampel: wewenang CEO/Manager (policy `samples_kelola`).
  const bolehKelola = bolehKelolaSampel(pengguna);

  const [riwayat, semuaAnggota] = await Promise.all([
    riwayatSampel(sampel.id),
    daftarAnggota(),
  ]);

  // Yang bisa memegang sampel adalah orang di unit yang sama; sampel
  // manajemen bisa dipegang siapa saja yang aktif.
  const anggota = semuaAnggota
    .filter((a) => !sampel.unitKode || a.unitId === sampel.unitKode)
    .map((a) => ({ id: a.id, nama: a.nama, jabatan: a.jabatan }));
  const gaya = GAYA_STATUS_SAMPEL[sampel.status];

  return (
    <AppShell pengguna={pengguna} halaman="Sampel">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/sampel"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Sampel
        </Link>

        <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
          <div className="flex items-start gap-3 px-5">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                sampel.status === "hilang"
                  ? "bg-danger-fill text-danger-text"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {sampel.status === "hilang" ? (
                <TriangleAlert className="size-5" />
              ) : (
                <Package className="size-5" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] leading-7 font-bold tracking-tight text-pretty">
                {sampel.nama}
              </h1>
              <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
                {sampel.kode}
              </p>
            </div>

            <span
              className={cn(
                "inline-flex h-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                gaya.kelas,
              )}
            >
              <span className={cn("size-1.5 rounded-full", gaya.titik)} />
              {LABEL_STATUS_SAMPEL[sampel.status]}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-2 px-5 text-[11px] leading-[14px]">
            <div className="rounded-2xl bg-muted/50 p-3">
              <dt className="text-muted-foreground">Kategori &amp; unit</dt>
              <dd className="text-[13px] leading-[18px] font-semibold">
                {sampel.kategori}
              </dd>
              <dd className="text-muted-foreground">{sampel.unitNama}</dd>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <dt className="text-muted-foreground">Nilai barang</dt>
              <dd className="tabular text-[13px] leading-[18px] font-semibold">
                {rupiahPenuh(sampel.nilai)}
              </dd>
            </div>
          </dl>

          <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {sampel.pemegangNama
              ? `Sekarang dipegang ${sampel.pemegangNama}.`
              : sampel.kreator
                ? `Sekarang ada di kreator ${sampel.kreator}.`
                : "Sekarang ada di gudang."}
            {sampel.catatan ? ` ${sampel.catatan}` : ""}
          </p>
        </Card>

        <Reveal>
          <KartuProduk sampel={sampel} bolehKelola={bolehKelola} />
        </Reveal>

        <Reveal>
          <AksiPerpindahan sampel={sampel} anggota={anggota} />
        </Reveal>

        <Reveal>
          <KartuQr
            kode={sampel.kode}
            nama={sampel.nama}
            brand={sampel.brand}
            nilai={sampel.nilai}
            unitNama={sampel.unitNama}
          />
        </Reveal>

        <Reveal>
          <PerjalananSampel sampel={sampel} riwayat={riwayat} acuan={acuan} />
        </Reveal>

        <Reveal>
          <RiwayatSampel daftar={riwayat} />
        </Reveal>
      </div>
    </AppShell>
  );
}
