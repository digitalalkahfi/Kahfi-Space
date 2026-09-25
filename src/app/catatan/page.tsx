import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Reveal } from "@/components/motion/reveal";
import { DaftarCatatan } from "@/components/catatan/daftar-catatan";
import { DialogTambahCatatan } from "@/components/catatan/dialog-catatan";
import { SaringCatatan } from "@/components/catatan/saring-catatan";
import { bacaSaringanCatatan, saringCatatan } from "@/lib/catatan";
import { daftarCatatan } from "@/lib/data/catatan";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Catatan — K-Space V2",
  description:
    "Catatan kerja pribadi yang bisa dibagikan ke unit atau perusahaan.",
};

export default async function CatatanPage({
  searchParams,
}: PageProps<"/catatan">) {
  const params = await searchParams;
  const { persona } = params;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const [semua, pilihan] = await Promise.all([
    daftarCatatan(pengguna),
    pilihanOrganisasi(),
  ]);
  const saringan = bacaSaringanCatatan(params);
  const daftar = saringCatatan(semua, saringan, pengguna.id);
  const acuan =
    modeData() === "demo"
      ? `${TANGGAL_ACUAN}T12:00:00+07:00`
      : new Date().toISOString();

  return (
    <AppShell pengguna={pengguna} halaman="Catatan">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Catatan
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              SOP, dokumentasi, dan catatan rapat. Milikmu sendiri sampai kamu
              membagikannya ke unit atau seluruh perusahaan.
            </p>
          </div>
          <DialogTambahCatatan pilihan={pilihan} unitBawaan={pengguna.unitId} />
        </div>

        <SaringCatatan
          saringan={saringan}
          jumlah={daftar.length}
          total={semua.length}
        />

        <Reveal>
          <DaftarCatatan
            daftar={daftar}
            penggunaId={pengguna.id}
            acuan={acuan}
          />
        </Reveal>
      </div>
    </AppShell>
  );
}
