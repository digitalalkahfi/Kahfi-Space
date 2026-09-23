import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { MatriksHak } from "@/components/tim/matriks-hak";
import { cn } from "@/lib/utils";
import { bilangan } from "@/lib/format";
import { DAFTAR_PERAN, bolehKelolaPeran } from "@/lib/hak-akses";
import { daftarAnggotaTim } from "@/lib/data/anggota";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Peran & Hak Akses — K-Space V2",
  description:
    "Siapa memegang peran apa, dan apa yang bisa dilakukan tiap peran.",
};

/**
 * Halaman peran & hak akses.
 *
 * Peran menentukan hampir semua hal yang terlihat seseorang, tapi
 * selama ini ia hanya muncul sebagai satu kata di kartu anggota.
 * Halaman ini menjawab dua pertanyaan yang selalu menyusul: siapa saja
 * yang memegang peran ini, dan apa artinya memegangnya.
 *
 * Penetapannya sendiri tetap lewat kartu anggota di halaman Anggota Tim
 * — satu tempat mengubah, bukan dua.
 */
export default async function PeranPage({
  searchParams,
}: PageProps<"/tim/peran">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const semua = await daftarAnggotaTim(pengguna);
  const aktif = semua.filter((a) => a.status === "aktif");

  const perPeran = DAFTAR_PERAN.map((p) => ({
    peran: p,
    orang: aktif
      .filter((a) => a.role === p)
      .sort((x, y) => x.nama.localeCompare(y.nama)),
  }));

  return (
    <AppShell pengguna={pengguna} halaman="Anggota Tim">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/tim/struktur"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Struktur organisasi
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Peran &amp; hak akses
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {bilangan(aktif.length)} orang aktif tersebar di{" "}
            {perPeran.filter((p) => p.orang.length > 0).length} peran.
            {bolehKelolaPeran(pengguna.role)
              ? " Penetapan perannya dilakukan lewat kartu anggota di halaman Anggota Tim."
              : " Hanya CEO dan Manager yang bisa mengubah peran seseorang."}
          </p>
        </div>

        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <div className="space-y-1 px-5">
            <h2 className="text-base leading-6 font-semibold">
              Siapa memegang peran apa
            </h2>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              Hanya anggota aktif; yang nonaktif tetap menyimpan riwayatnya di
              kartu masing-masing.
            </p>
          </div>

          <ul className="space-y-1.5 px-5">
            {perPeran.map(({ peran, orang }) => (
              <li
                key={peran}
                className={cn(
                  "rounded-2xl bg-muted/50 px-3 py-2",
                  orang.length === 0 && "opacity-70",
                )}
              >
                <p className="flex items-baseline gap-2">
                  <span className="text-[13px] leading-[18px] font-semibold">
                    {peran}
                  </span>
                  <span className="tabular text-[11px] leading-[14px] text-muted-foreground">
                    {orang.length === 0
                      ? "belum ada yang memegang"
                      : `${bilangan(orang.length)} orang`}
                  </span>
                </p>
                {orang.length > 0 ? (
                  <p className="mt-0.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                    {orang.map((a) => a.nama).join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <Reveal>
          <MatriksHak />
        </Reveal>
      </div>
    </AppShell>
  );
}
