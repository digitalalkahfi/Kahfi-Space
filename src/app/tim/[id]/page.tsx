import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import {
  AkunDipegang,
  GarisPelaporan,
  KepalaProfil,
  KpiAnggota,
} from "@/components/tim/profil-anggota";
import { AsetDipegangKartu } from "@/components/aset/aset-dipegang";
import { JejakAnggotaKartu } from "@/components/tim/jejak-anggota";
import { Reveal } from "@/components/motion/reveal";
import {
  bolehKelolaAnggota,
  daftarAnggotaTim,
  jejakAnggota,
} from "@/lib/data/anggota";
import { daftarAkun } from "@/lib/data/akun";
import { kontakAnggota } from "@/lib/data/profil";
import { VerifikasiKontak } from "@/components/tim/verifikasi-kontak";
import { asetDipegang } from "@/lib/data/aset";
import { scorecardTim } from "@/lib/data/kpi";
import { petaRantai } from "@/lib/atasan";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { bulanPanjang } from "@/lib/format";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export async function generateMetadata({
  params,
}: PageProps<"/tim/[id]">): Promise<Metadata> {
  const { id } = await params;
  const pengguna = await sesiSaatIni();
  if (!pengguna) return { title: "Anggota — K-Space V2" };

  const anggota = (await daftarAnggotaTim(pengguna)).find((a) => a.id === id);
  return {
    title: anggota ? `${anggota.nama} — K-Space V2` : "Anggota — K-Space V2",
    description: anggota
      ? `Profil ${anggota.nama}: ${anggota.jabatan}.`
      : undefined,
  };
}

export default async function ProfilAnggotaPage({
  params,
  searchParams,
}: PageProps<"/tim/[id]">) {
  const [{ id }, { persona }] = await Promise.all([params, searchParams]);
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const semua = await daftarAnggotaTim(pengguna);
  const anggota = semua.find((a) => a.id === id);
  // Yang tidak terlihat oleh cakupan perannya memang tidak ada baginya.
  if (!anggota) notFound();

  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);
  const bulan = `${tanggal.slice(0, 7)}-01`;

  // Jejak perubahan hanya berarti bagi yang berwenang mengubahnya.
  const kelola = bolehKelolaAnggota(pengguna);
  const kontak = await kontakAnggota(anggota.id);
  const [akun, scorecard, jejak, aset] = await Promise.all([
    daftarAkun(pengguna, bulan, tanggal),
    scorecardTim(pengguna, bulan, tanggal),
    kelola ? jejakAnggota(id) : Promise.resolve([]),
    asetDipegang(id),
  ]);

  const rantai = petaRantai(semua)[anggota.id] ?? [];
  const bawahanLangsung = semua.filter(
    (a) => a.atasanId === anggota.id && a.status === "aktif",
  );
  const akunnya = akun.filter((a) => a.picId === anggota.id);
  const kpi = scorecard.find((b) => b.userId === anggota.id) ?? null;

  const bulanLabel = bulanPanjang(bulan);

  return (
    <AppShell pengguna={pengguna} halaman="Anggota Tim">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/tim"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Anggota tim
        </Link>

        <KepalaProfil anggota={anggota} bolehKelola={kelola} />

        {/* Verifikasi nomor adalah pernyataan pihak ketiga; tempatnya
            di halaman orang yang diverifikasi, bukan di profil sendiri. */}
        {kelola ? (
          <VerifikasiKontak
            userId={anggota.id}
            nama={anggota.nama.split(" ")[0]}
            kontak={kontak.kontak}
            terverifikasi={kontak.terverifikasi}
          />
        ) : null}

        <Reveal>
          <GarisPelaporan rantai={rantai} bawahanLangsung={bawahanLangsung} />
        </Reveal>

        {akunnya.length > 0 ? (
          <Reveal>
            <AkunDipegang daftar={akunnya} />
          </Reveal>
        ) : null}

        {kpi ? (
          <Reveal>
            <KpiAnggota baris={kpi} bulanLabel={bulanLabel} />
          </Reveal>
        ) : null}

        <Reveal>
          <AsetDipegangKartu daftar={aset} />
        </Reveal>

        {kelola ? (
          <Reveal>
            <JejakAnggotaKartu jejak={jejak} />
          </Reveal>
        ) : null}
      </div>
    </AppShell>
  );
}
