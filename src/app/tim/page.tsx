import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DaftarAnggota } from "@/components/tim/daftar-anggota";
import { SaringAnggota } from "@/components/tim/saring-anggota";
import { Reveal } from "@/components/motion/reveal";
import {
  bolehKelolaAnggota,
  daftarAnggotaTim,
  kelompokkanPerUnit,
} from "@/lib/data/anggota";
import { DialogTambahAnggota } from "@/components/tim/dialog-anggota";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { petaBawahan, petaRantai } from "@/lib/atasan";
import {
  bacaSaringan,
  saringAnggota,
  saringanAktif,
} from "@/lib/saring-anggota";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Anggota Tim — K-Space V2",
  description: "Direktori anggota tim Al-Kahfi Corp beserta peran dan unitnya.",
};

export default async function TimPage({ searchParams }: PageProps<"/tim">) {
  const params = await searchParams;
  const pengguna = await sesiSaatIni(
    peranValid(params.persona) ? params.persona : undefined,
  );
  if (!pengguna) redirect("/masuk");

  const [semua, pilihan] = await Promise.all([
    daftarAnggotaTim(pengguna),
    pilihanOrganisasi(),
  ]);
  const saringan = bacaSaringan(params);
  const daftar = saringAnggota(semua, saringan);
  const kelompok = kelompokkanPerUnit(daftar);

  // Pilihan unit diambil dari daftar penuh, supaya menyaring satu unit
  // tidak membuat unit lain lenyap dari pilihannya.
  const unit = [...new Set(semua.map((a) => a.unitNama))].sort((a, b) =>
    a === "Manajemen" ? -1 : b === "Manajemen" ? 1 : a.localeCompare(b),
  );

  // Departemen dan program diambil dari anggota yang ada, bukan dari
  // seluruh tabel: pilihan yang tak menyaring siapa pun hanya menipu.
  // Sumbu yang nilainya sama untuk semua orang ikut disembunyikan.
  const nilaiSaringan = (ambil: (a: (typeof semua)[number]) => string | null) => {
    const ada = semua.map(ambil);
    const nilai = [...new Set(ada.filter((v) => v !== null))].sort();
    const menyaring = nilai.length > 1 || ada.some((v) => v === null);
    return menyaring ? nilai : [];
  };

  const departemen = nilaiSaringan((a) => a.departemen);
  const program = nilaiSaringan((a) => a.program);

  const aktif = semua.filter((a) => a.status === "aktif").length;
  const bolehKelola = bolehKelolaAnggota(pengguna);

  // Garis pelaporan diturunkan sekali dari daftar yang sudah dimuat.
  const rantai = petaRantai(semua);
  const bawahan = petaBawahan(semua);

  return (
    <AppShell pengguna={pengguna} halaman="Anggota Tim">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Anggota tim
            </h1>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              {aktif} orang aktif di {unit.length} kelompok
              {semua.length > aktif
                ? ` · ${semua.length - aktif} nonaktif masih menyimpan riwayat`
                : ""}
              .
            </p>
          </div>

          {bolehKelola ? <DialogTambahAnggota pilihan={pilihan} /> : null}
        </div>

        <SaringAnggota
          saringan={saringan}
          unit={unit}
          departemen={departemen}
          program={program}
          jumlah={daftar.length}
          total={semua.length}
        />

        {daftar.length === 0 && saringanAktif(saringan) ? (
          <p className="rounded-3xl bg-card px-5 py-4 text-[13px] leading-[18px] text-muted-foreground ring-1 ring-border-subtle">
            Tidak ada anggota yang cocok dengan saringan ini.
          </p>
        ) : (
          <Reveal>
            <DaftarAnggota
              kelompok={kelompok}
              pilihan={pilihan}
              semua={semua}
              rantai={rantai}
              bawahan={bawahan}
              bolehKelola={bolehKelola}
            />
          </Reveal>
        )}
      </div>
    </AppShell>
  );
}
