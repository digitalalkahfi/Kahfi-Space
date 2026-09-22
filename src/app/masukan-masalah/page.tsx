import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import {
  DaftarMasukan,
  RingkasanMasukan,
} from "@/components/masukan/daftar-masukan";
import { SaringMasukan } from "@/components/masukan/saring-masukan";
import { DialogKirimMasukan } from "@/components/masukan/dialog-masukan";
import {
  DaftarMasalah,
  RingkasanMasalah,
} from "@/components/masalah/daftar-masalah";
import { SaringMasalah } from "@/components/masalah/saring-masalah";
import { DialogTambahMasalah } from "@/components/masalah/dialog-masalah";
import { TabTerpaduNav } from "@/components/masukan-masalah/tab-terpadu";
import { Reveal } from "@/components/motion/reveal";
import { bacaSaringanMasukan, saringMasukan } from "@/lib/masukan";
import { bacaSaringanMasalah, saringMasalah } from "@/lib/saring-masalah";
import { bacaTab } from "@/lib/masukan-masalah";
import { daftarMasukan } from "@/lib/data/masukan";
import { daftarMasalah } from "@/lib/data/masalah";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Masukan & Masalah — K-Space V2",
  description:
    "Masukan, bug, dan laporan Kaizen beserta solusinya dalam satu halaman bertab.",
};

/**
 * Halaman gabungan Masukan & Masalah (PRD Fase 2).
 *
 * Dua modul yang selama ini terpisah dipertemukan tanpa dilebur: tiap
 * tab memakai kembali daftar, saringan, dan dialog yang sudah ada, dan
 * halaman lamanya tetap hidup. Yang berubah cuma satu — orang tidak
 * perlu lagi menebak apakah keluhannya "masukan" atau "masalah" sebelum
 * menemukan tempatnya.
 */
export default async function MasukanMasalahPage({
  searchParams,
}: PageProps<"/masukan-masalah">) {
  const params = await searchParams;
  const pengguna = await sesiSaatIni(
    peranValid(params.persona) ? params.persona : undefined,
  );
  if (!pengguna) redirect("/masuk");

  const tab = bacaTab(params.tab);

  const [semuaMasukan, semuaMasalah, pilihan] = await Promise.all([
    daftarMasukan(pengguna),
    daftarMasalah(pengguna),
    pilihanOrganisasi(),
  ]);

  const acuan =
    modeData() === "demo"
      ? `${TANGGAL_ACUAN}T12:00:00+07:00`
      : new Date().toISOString();

  // Masukan dan bug berbagi satu tabel; yang memisahkan keduanya hanya
  // jenisnya. Saringannya pun sama, jadi dipakai ulang apa adanya.
  const bug = semuaMasukan.filter((m) => m.jenis === "bug");
  const saran = semuaMasukan.filter((m) => m.jenis !== "bug");
  const sumberMasukan = tab === "bug" ? bug : saran;

  const saringanMasukan = bacaSaringanMasukan(params);
  const masukanTersaring = saringMasukan(sumberMasukan, saringanMasukan);

  const saringanMasalah = bacaSaringanMasalah(params);
  const masalahTersaring = saringMasalah(semuaMasalah, saringanMasalah);
  const unit = [...new Set(semuaMasalah.map((m) => m.unitNama))].sort();

  const jumlah = {
    masukan: saran.length,
    bug: bug.length,
    masalah: semuaMasalah.length,
  };

  return (
    <AppShell pengguna={pengguna} halaman="Masukan & Masalah">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Masukan &amp; masalah
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Keluhan pemakai aplikasi dan masalah operasional berakhir pada
              pertanyaan yang sama: sudah ditindak atau belum.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/masukan/saya"
              className="tekan-halus sentuh-nyaman inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-4 text-[11px] leading-[18px] font-semibold ring-1 ring-border-subtle"
            >
              <Inbox className="size-3.5" />
              Kiriman saya
            </Link>

            {tab === "masalah" ? (
              <DialogTambahMasalah
                pilihan={pilihan}
                unitBawaan={pengguna.unitId}
              />
            ) : (
              <DialogKirimMasukan terbuka={semuaMasukan} />
            )}
          </div>
        </div>

        <TabTerpaduNav aktif={tab} jumlah={jumlah} />

        {tab === "masukan" || tab === "bug" ? (
          <>
            <RingkasanMasukan daftar={sumberMasukan} />

            <SaringMasukan
              saringan={saringanMasukan}
              jumlah={masukanTersaring.length}
              total={sumberMasukan.length}
            />

            <Reveal>
              <DaftarMasukan daftar={masukanTersaring} acuan={acuan} />
            </Reveal>
          </>
        ) : null}

        {tab === "masalah" ? (
          <>
            <RingkasanMasalah daftar={semuaMasalah} />

            <SaringMasalah
              saringan={saringanMasalah}
              unit={unit}
              jumlah={masalahTersaring.length}
              total={semuaMasalah.length}
            />

            <Reveal>
              <DaftarMasalah daftar={masalahTersaring} acuan={acuan} />
            </Reveal>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
