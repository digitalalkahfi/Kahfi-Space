import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DaftarHari } from "@/components/kalender/daftar-hari";
import { PetakKalender } from "@/components/kalender/petak-kalender";
import { SinkronAgenda } from "@/components/kalender/sinkron-agenda";
import { Reveal } from "@/components/motion/reveal";
import { bolehKelolaAgenda, entriKalender } from "@/lib/data/kalender";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { DialogTambahAgenda } from "@/components/kalender/dialog-agenda";
import { bulanDari } from "@/lib/kalender";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Kalender — K-Space V2",
  description:
    "Agenda bersama beserta tenggat tugas yang ditarik langsung dari modul Tugas.",
};

const POLA_BULAN = /^\d{4}-\d{2}-01$/;

export default async function KalenderPage({
  searchParams,
}: PageProps<"/kalender">) {
  const { persona, bulan } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const hariIni =
    modeData() === "demo" ? TANGGAL_ACUAN : new Date().toISOString().slice(0, 10);

  // Parameter bulan berasal dari URL; yang tidak berbentuk diabaikan.
  const bulanAktif =
    typeof bulan === "string" && POLA_BULAN.test(bulan)
      ? bulan
      : bulanDari(hariIni);

  const bolehKelola = bolehKelolaAgenda(pengguna);
  const [entri, pilihan] = await Promise.all([
    entriKalender(pengguna, bulanAktif),
    bolehKelola ? pilihanOrganisasi() : Promise.resolve(null),
  ]);

  // Leader & Co-Leader terkunci pada unitnya sendiri (policy agenda_unit_kelola).
  const unitTerkunci =
    pengguna.role === "Leader" || pengguna.role === "Co-Leader"
      ? pengguna.unitId
      : null;

  return (
    <AppShell pengguna={pengguna} halaman="Kalender">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Kalender
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Agenda bersama beserta tenggat tugas yang ditarik langsung dari
              modul Tugas — menggeser tenggatnya di sana langsung terlihat di
              sini.
            </p>
          </div>

          {pilihan ? (
            <DialogTambahAgenda
              pilihan={pilihan}
              tanggalBawaan={hariIni}
              unitTerkunci={unitTerkunci}
            />
          ) : null}
        </div>

        {/* Siaran perubahan hanya ada di mode Supabase (0096). */}
        {modeData() === "supabase" ? <SinkronAgenda /> : null}

        <PetakKalender bulan={bulanAktif} entri={entri} hariIni={hariIni} />

        <Reveal>
          <DaftarHari
            bulan={bulanAktif}
            entri={entri}
            hariIni={hariIni}
            bolehUbah={bolehKelola}
            pilihan={pilihan}
            unitTerkunci={unitTerkunci}
          />
        </Reveal>
      </div>
    </AppShell>
  );
}
