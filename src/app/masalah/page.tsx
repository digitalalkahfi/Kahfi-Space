import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import {
  DaftarMasalah,
  RingkasanMasalah,
} from "@/components/masalah/daftar-masalah";
import { SaringMasalah } from "@/components/masalah/saring-masalah";
import { Reveal } from "@/components/motion/reveal";
import { bacaSaringanMasalah, saringMasalah } from "@/lib/saring-masalah";
import { daftarMasalah } from "@/lib/data/masalah";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { DialogTambahMasalah } from "@/components/masalah/dialog-masalah";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Kaizen — K-Space V2",
  description:
    "Laporan masalah dari lapangan beserta solusi yang ditulis manajemen.",
};

export default async function MasalahPage({
  searchParams,
}: PageProps<"/masalah">) {
  const params = await searchParams;
  const { persona } = params;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const [semua, pilihan] = await Promise.all([
    daftarMasalah(pengguna),
    pilihanOrganisasi(),
  ]);

  const saringan = bacaSaringanMasalah(params);
  const daftar = saringMasalah(semua, saringan);

  // Pilihan unit diambil dari daftar penuh supaya menyaring satu unit
  // tidak membuat unit lain lenyap dari pilihannya.
  const unit = [...new Set(semua.map((m) => m.unitNama))].sort();
  const acuan =
    modeData() === "demo"
      ? `${TANGGAL_ACUAN}T12:00:00+07:00`
      : new Date().toISOString();

  return (
    <AppShell pengguna={pengguna} halaman="Kaizen">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Kaizen
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Siapa pun boleh melapor. Manajemen menerimanya, menuliskan
              solusinya, lalu menandainya selesai — dan solusi itu tinggal di
              sini untuk orang berikutnya yang kena masalah sama.
            </p>
          </div>

          <DialogTambahMasalah pilihan={pilihan} unitBawaan={pengguna.unitId} />
        </div>

        <RingkasanMasalah daftar={semua} />

        <SaringMasalah
          saringan={saringan}
          unit={unit}
          jumlah={daftar.length}
          total={semua.length}
        />

        <Reveal>
          <DaftarMasalah daftar={daftar} acuan={acuan} />
        </Reveal>
      </div>
    </AppShell>
  );
}
