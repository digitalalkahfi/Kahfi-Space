import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Reveal } from "@/components/motion/reveal";
import { DaftarDepartemen } from "@/components/tim/daftar-departemen";
import { PohonStruktur } from "@/components/tim/pohon-struktur";
import { SusunanOrganisasi } from "@/components/tim/susunan-organisasi";
import { periksaStruktur } from "@/lib/atasan";
import { bolehKelolaAnggota, daftarAnggotaTim } from "@/lib/data/anggota";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { susunanDepartemen } from "@/lib/organisasi";
import { pohonStruktur, tercecer } from "@/lib/struktur";
import { DAFTAR_UNIT } from "@/lib/unit-pelaporan";
import { gayaUnit } from "@/lib/unit";
import { cn } from "@/lib/utils";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Struktur Organisasi — K-Space V2",
  description:
    "Susunan departemen dan garis pelaporan: siapa melapor kepada siapa.",
};

/**
 * Halaman struktur organisasi.
 *
 * Halaman Anggota Tim menjawab "siapa saja"; halaman ini menjawab
 * "bagaimana susunannya". Dipisah karena yang pertama dibuka untuk
 * mencari satu orang, dan pohon setinggi seluruh perusahaan di atasnya
 * hanya akan membuat pencarian itu lebih jauh.
 */
export default async function StrukturPage({
  searchParams,
}: PageProps<"/tim/struktur">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const [semua, pilihan] = await Promise.all([
    daftarAnggotaTim(pengguna),
    pilihanOrganisasi(),
  ]);

  const pohon = pohonStruktur(semua);
  const lepas = tercecer(semua, pohon);
  const susunan = susunanDepartemen(semua, pilihan);
  const aktif = semua.filter((a) => a.status === "aktif").length;
  // Pemeriksaan aturan hanya berarti bagi yang bisa membetulkannya.
  const bolehKelola = bolehKelolaAnggota(pengguna);
  const periksa = bolehKelola ? periksaStruktur(semua) : undefined;

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

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Struktur organisasi
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {aktif} orang aktif, tersusun dalam {susunan.length} departemen.
            Garis pelaporannya diturunkan dari atasan yang tercatat pada tiap
            anggota, mengikuti jenjang CEO → Manager → Leader → Co-Leader →
            Staff.
          </p>
        </div>

        {/* Bagan pelaporan didahulukan: itulah jawaban atas "siapa melapor
            kepada siapa" — pertanyaan yang membawa orang ke halaman ini. */}
        <Reveal>
          <PohonStruktur
            pohon={pohon}
            tercecer={lepas.map((a) => ({
              id: a.id,
              nama: a.nama,
              jabatan: a.jabatan,
            }))}
            periksa={periksa}
            bolehKelola={bolehKelola}
          />
        </Reveal>

        <Reveal>
          <SusunanOrganisasi
            daftar={susunan}
            tanpaDepartemen={
              semua.filter((a) => a.status === "aktif" && !a.departemen).length
            }
          />
        </Reveal>

        {/* Tiga unit pelaporan disebut lebih dulu: departemen menjawab
            "siapa sekelompok dengan siapa", unit menjawab "bagaimana
            kelompok itu melapor" — dan yang kedua menentukan kewajiban
            harian tiap orang. */}
        <nav aria-label="Unit pelaporan" className="grid gap-2 sm:grid-cols-3">
          {DAFTAR_UNIT.map((u) => {
            const isi = semua.filter(
              (a) => a.status === "aktif" && a.unitKode === u.kode,
            ).length;
            return (
              <Link
                key={u.kode}
                href={`/tim/unit/${u.kode}`}
                className="baris-interaktif flex items-center gap-2.5 rounded-2xl bg-card px-3.5 py-2.5 ring-1 ring-border-subtle"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    gayaUnit[u.kode].bar,
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-[18px] font-semibold">
                    {u.nama}
                  </span>
                  <span className="tabular block text-[11px] leading-[14px] text-muted-foreground">
                    {isi} orang · lapor per {u.lapor}
                  </span>
                </span>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </nav>

        <Reveal>
          <DaftarDepartemen daftar={susunan} anggota={semua} />
        </Reveal>

        <Link
          href="/tim/peran"
          className="baris-interaktif flex items-center gap-2.5 rounded-2xl bg-card px-3.5 py-2.5 ring-1 ring-border-subtle"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-[18px] font-semibold">
              Peran &amp; hak akses
            </span>
            <span className="block text-[11px] leading-[14px] text-muted-foreground">
              Siapa memegang peran apa, dan apa yang bisa dilakukan tiap peran.
            </span>
          </span>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        </Link>

        <Link
          href="/tim/program"
          className="baris-interaktif flex items-center gap-2.5 rounded-2xl bg-card px-3.5 py-2.5 ring-1 ring-border-subtle"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-[18px] font-semibold">
              Kelola program
            </span>
            <span className="block text-[11px] leading-[14px] text-muted-foreground">
              Program tiap unit beserta berapa anggota dan akun yang memakainya.
            </span>
          </span>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        </Link>
      </div>
    </AppShell>
  );
}
