import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  MapPin,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { AksiPemegang } from "@/components/aset/aksi-pemegang";
import { DialogUbahAset } from "@/components/aset/dialog-aset";
import { JejakDataAsetKartu } from "@/components/aset/jejak-data-aset";
import { JadwalPenyusutan } from "@/components/aset/jadwal-penyusutan";
import { RiwayatAset } from "@/components/aset/riwayat-aset";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { rupiahPenuh, tanggalPendek } from "@/lib/format";
import {
  GAYA_STATUS_ASET,
  LABEL_STATUS_ASET,
  akumulasiPenyusutan,
  nilaiBuku,
  penyusutanPerBulan,
  sisaMasaManfaat,
  sudahLepas,
} from "@/lib/aset";
import {
  asetDariKode,
  bolehKelolaAset,
  bolehLihatNilaiAset,
  jejakDataAset,
  riwayatAset,
} from "@/lib/data/aset";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { daftarAnggota, peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export async function generateMetadata({
  params,
}: PageProps<"/aset/[kode]">): Promise<Metadata> {
  const { kode } = await params;
  return {
    title: `${decodeURIComponent(kode).toUpperCase()} — Aset K-Space V2`,
    description: "Nilai buku, penyusutan, pemegang, dan keadaan satu aset.",
  };
}

/** Sebaris keterangan: label kecil di atas, isinya di bawah. */
function Keterangan({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-muted/50 p-3">
      <dt className="text-[11px] leading-[14px] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[13px] leading-[18px] font-semibold text-pretty">
        {children}
      </dd>
    </div>
  );
}

export default async function DetailAsetPage({
  params,
  searchParams,
}: PageProps<"/aset/[kode]">) {
  const [{ kode }, { persona }] = await Promise.all([params, searchParams]);
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const aset = await asetDariKode(pengguna, decodeURIComponent(kode));
  if (!aset) notFound();

  const bolehKelola = bolehKelolaAset(pengguna);
  const bolehNilai = bolehLihatNilaiAset(pengguna);
  const [riwayat, semuaAnggota, pilihan, jejakData] = await Promise.all([
    riwayatAset(aset.kode),
    bolehKelola ? daftarAnggota() : Promise.resolve([]),
    pilihanOrganisasi(),
    // Jejak penyuntingan adalah angka perusahaan juga: ia memuat nilai
    // perolehan lama dan barunya.
    bolehNilai ? jejakDataAset(aset.id) : Promise.resolve([]),
  ]);

  // Pemegang aset unit dibatasi orang unit itu; aset perusahaan boleh
  // dipegang siapa saja yang masih aktif.
  const anggota = semuaAnggota
    .filter((a) => !aset.unitKode || a.unitId === aset.unitKode)
    .map((a) => ({ id: a.id, nama: a.nama, jabatan: a.jabatan }));

  const hariIni =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const gaya = GAYA_STATUS_ASET[aset.status];
  const susut = akumulasiPenyusutan(aset, hariIni);
  const buku = nilaiBuku(aset, hariIni);
  const sisa = sisaMasaManfaat(aset, hariIni);
  const terpakai =
    aset.nilaiPerolehan > 0
      ? Math.min(100, (susut / aset.nilaiPerolehan) * 100)
      : 0;

  return (
    <AppShell pengguna={pengguna} halaman="Aset">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/aset"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Aset
        </Link>

        {bolehKelola ? (
          <div className="flex justify-end">
            <DialogUbahAset aset={aset} pilihan={pilihan} />
          </div>
        ) : null}

        <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
          <div className="flex items-start gap-3 px-5">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                aset.status === "hilang"
                  ? "bg-danger-fill text-danger-text"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {aset.status === "hilang" ? (
                <TriangleAlert className="size-5" />
              ) : (
                <Boxes className="size-5" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] leading-7 font-bold tracking-tight text-pretty lg:text-[28px] lg:leading-9">
                {aset.nama}
              </h1>
              <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
                {aset.kode}
              </p>
              <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
                {aset.kategori} · {aset.unitNama} · diperoleh{" "}
                {tanggalPendek(aset.tanggal)}
              </p>
            </div>

            <span
              className={cn(
                "inline-flex h-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                gaya.kelas,
              )}
            >
              <span className={cn("size-1.5 rounded-full", gaya.titik)} />
              {LABEL_STATUS_ASET[aset.status]}
            </span>
          </div>

          <dl className="grid grid-cols-1 gap-2 px-5 sm:grid-cols-2">
            <Keterangan label="Pemegang">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-3.5 text-muted-foreground" />
                {aset.pemegangNama ?? "Belum ada pemegang"}
              </span>
            </Keterangan>
            <Keterangan label="Lokasi">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-muted-foreground" />
                {aset.lokasi || "—"}
              </span>
            </Keterangan>
          </dl>

          {aset.catatan ? (
            <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
              {aset.catatan}
            </p>
          ) : null}
        </Card>

        {bolehNilai ? (
          <Reveal>
            <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
              <div className="px-5">
                <h2 className="text-base leading-6 font-semibold">
                  Nilai aset
                </h2>
                <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
                  {sudahLepas(aset.status)
                    ? "Aset ini tidak lagi dimiliki, jadi nilai bukunya nol."
                    : "Nilai perolehan dikurangi penyusutan yang sudah diakui."}
                </p>
              </div>

              <div className="tabular px-5">
                <div className="rounded-2xl bg-muted/50 p-3.5">
                  <p className="text-[11px] leading-[14px] text-muted-foreground">
                    Nilai buku per {tanggalPendek(hariIni)}
                  </p>
                  <p className="text-[22px] leading-7 font-bold tracking-tight">
                    {rupiahPenuh(buku)}
                  </p>
                  <div
                    className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border-subtle"
                    role="img"
                    aria-label={`${Math.round(terpakai)} persen nilai perolehan sudah disusutkan`}
                  >
                    <div
                      className="h-full rounded-full bg-secondary transition-[width] duration-700 ease-out motion-reduce:transition-none"
                      style={{ width: `${terpakai}%` }}
                    />
                  </div>
                </div>
              </div>

              <dl className="tabular grid grid-cols-2 gap-2 px-5">
                <Keterangan label="Nilai perolehan">
                  {rupiahPenuh(aset.nilaiPerolehan)}
                </Keterangan>
                <Keterangan label="Akumulasi penyusutan">
                  −{rupiahPenuh(susut)}
                </Keterangan>
                <Keterangan label="Nilai residu">
                  {rupiahPenuh(aset.residu)}
                </Keterangan>
                <Keterangan label="Beban per bulan">
                  {aset.masaManfaat === 0
                    ? "Tidak disusutkan"
                    : sudahLepas(aset.status)
                      ? "Berhenti"
                      : rupiahPenuh(Math.round(penyusutanPerBulan(aset)))}
                </Keterangan>
                <Keterangan label="Masa manfaat">
                  {aset.masaManfaat === 0 ? "—" : `${aset.masaManfaat} bulan`}
                </Keterangan>
                <Keterangan label="Sisa masa manfaat">
                  {/* Sisa umur tidak berarti apa-apa untuk barang yang
                      sudah tidak dimiliki. */}
                  {aset.masaManfaat === 0 || sudahLepas(aset.status)
                    ? "—"
                    : sisa === 0
                      ? "Habis"
                      : `${sisa} bulan`}
                </Keterangan>
              </dl>

              {aset.berakhir ? (
                <p className="px-5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  Penyusutan berhenti {tanggalPendek(aset.berakhir)}, saat aset
                  ini{" "}
                  {aset.status === "hilang" ? "dinyatakan hilang" : "dilepas"}.
                </p>
              ) : null}
            </Card>
          </Reveal>
        ) : null}

        {bolehKelola ? (
          <Reveal>
            <AksiPemegang aset={aset} anggota={anggota} />
          </Reveal>
        ) : null}

        <Reveal>
          <RiwayatAset daftar={riwayat} />
        </Reveal>

        {bolehNilai ? (
          <Reveal>
            <JadwalPenyusutan aset={aset} sampai={hariIni} />
          </Reveal>
        ) : null}

        {bolehNilai ? (
          <Reveal>
            <JejakDataAsetKartu daftar={jejakData} />
          </Reveal>
        ) : null}
      </div>
    </AppShell>
  );
}
