import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { GmvPerUnit } from "@/components/beranda/gmv-per-unit";
import { KartuCapaianPribadi } from "@/components/beranda/capaian-pribadi";
import { HeroWrm } from "@/components/beranda/hero-wrm";
import { AgendaTerdekat } from "@/components/beranda/agenda-terdekat";
import { PosisiKas } from "@/components/beranda/posisi-kas";
import { KartuPengumuman } from "@/components/beranda/kartu-pengumuman";
import { KartuSapaan } from "@/components/beranda/kartu-sapaan";
import { PantauKehadiran } from "@/components/beranda/pantau-kehadiran";
import { PratinjauPeran } from "@/components/beranda/pratinjau-peran";
import { StatusTim } from "@/components/beranda/status-tim";
import { TargetBulanan } from "@/components/beranda/target-bulanan";
import { ToDoHariIni } from "@/components/beranda/todo-hari-ini";
import { TugasMendesak } from "@/components/beranda/tugas-mendesak";
import { Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { bolehLihat } from "@/lib/akses";
import { SusunanBeranda } from "@/components/tampilan/susunan-beranda";
import {
  katalogUntuk,
  preferensiTampilanSaya,
} from "@/lib/data/preferensi-tampilan";
import { itemTerlihat } from "@/lib/tampilan";
import { ringkasanGmv } from "@/lib/data/gmv";
import { capaianPribadi } from "@/lib/data/capaian";
import { rekapKehadiran } from "@/lib/data/kehadiran";
import { ambilToDo, ambilTugasMendesak } from "@/lib/data/tugas";
import { ambilPengumuman } from "@/lib/data/pengumuman";
import { agendaAkanDatang } from "@/lib/data/kalender";
import { ringkasPeriode } from "@/lib/data/keuangan";
import { RINGKAS_KOSONG, bolehLihatKeuangan } from "@/lib/keuangan";
import { DAFTAR_PERAN, peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { catatanRitme, keputusanDariCapaian } from "@/lib/wrm";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { modeData } from "@/lib/supabase/config";
import type { Peran } from "@/lib/types";

export const metadata: Metadata = {
  title: "Beranda — K-Space V2",
  description:
    "Dasbor harian sesuai peran: GMV vs target, to-do, kehadiran, dan pengumuman.",
};

function peranDariUrl(nilai: string | string[] | undefined): Peran | undefined {
  const kandidat = Array.isArray(nilai) ? nilai[0] : nilai;
  return peranValid(kandidat) ? kandidat : undefined;
}

export default async function BerandaPage({
  searchParams,
}: PageProps<"/beranda">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranDariUrl(persona));
  if (!pengguna) redirect("/masuk");
  const peran = pengguna.role;

  // Mode demo mematok "hari ini" ke tanggal data contoh supaya dasbornya berisi.
  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);
  // Data contoh berhenti di jam sinkron terakhirnya; mode nyata memakai jam kini.
  const disinkronPada =
    modeData() === "demo"
      ? `${TANGGAL_ACUAN}T14:20:00+07:00`
      : new Date().toISOString();
  const bolehKeuangan = bolehLihatKeuangan(pengguna.role);
  const [
    pengumuman,
    gmv,
    toDo,
    tugasMendesak,
    kehadiran,
    agenda,
    kas,
    capaian,
  ] = await Promise.all([
    ambilPengumuman(pengguna),
    ringkasanGmv(pengguna, tanggal),
    ambilToDo(pengguna),
    ambilTugasMendesak(pengguna),
    rekapKehadiran(pengguna, tanggal),
    agendaAkanDatang(pengguna, tanggal),
    // Beranda hanya menampilkan posisi kas, bukan daftar transaksinya:
    // basis data yang meringkas (migrasi 0099) supaya halaman ini tidak
    // menarik seluruh mutasi hanya untuk satu angka. Yang tidak berhak
    // melihat angka perusahaan pun tidak perlu menanyakannya.
    bolehKeuangan ? ringkasPeriode() : Promise.resolve(RINGKAS_KOSONG),
    // Peran yang memang tidak punya kartu ini tidak perlu membayar satu
    // RPC lagi setiap kali membuka Beranda.
    bolehLihat(peran, "capaianPribadi")
      ? capaianPribadi(pengguna, tanggal)
      : Promise.resolve(null),
  ]);

  // Cakupan angka sudah dibatasi di lapisan data (RLS di mode Supabase).
  const unit = gmv.unit;
  const rasioHariIni =
    gmv.targetHarian > 0 ? (gmv.gmvHariIni / gmv.targetHarian) * 100 : 0;
  const keputusanWrm = keputusanDariCapaian(rasioHariIni);

  // Dua saringan, dan keduanya perlu. `bolehLihat` menjawab "boleh
  // dilihat peran ini"; preferensi menjawab "mau dilihat orang ini".
  // Yang kedua dikerjakan di server juga — bukan hanya di browser —
  // supaya widget yang disembunyikan tidak ikut terkirim sama sekali.
  const katalog = katalogUntuk(pengguna);
  const { preferensi } = await preferensiTampilanSaya(pengguna);
  const dipilih = new Set(
    itemTerlihat(katalog, preferensi, "beranda").map((i) => i.kunci),
  );

  const tampil = (widget: Parameters<typeof bolehLihat>[1]) =>
    bolehLihat(peran, widget) && dipilih.has(widget);

  // Catatan ritme bicara soal 3 lini bisnis — hanya relevan bila semua terlihat.
  const lihatSemuaUnit = unit.length === 3;

  return (
    <AppShell pengguna={pengguna} halaman="Beranda">
      <div className="space-y-4 lg:space-y-6">
        {/* Pemilih peran hanya berarti di mode demo: begitu Supabase
            menyala, peran datang dari sesi dan parameter `persona`
            diabaikan — tombol yang tidak mengubah apa pun lebih
            membingungkan daripada tidak ada. */}
        {modeData() === "demo" ? (
          <Suspense fallback={null}>
            <PratinjauPeran daftar={DAFTAR_PERAN} aktif={peran} />
          </Suspense>
        ) : null}

        {/* Parallax ringan: blok sapaan hanyut sedikit lebih lambat dari scroll. */}
        <Parallax jarak={10}>
          <KartuSapaan
            pengguna={pengguna}
            tanggal={tanggal}
            disinkronPada={disinkronPada}
          />
        </Parallax>

        <SusunanBeranda
          hero={
            tampil("wrm")
              ? [
                  {
                    kunci: "wrm",
                    isi: (
                      <HeroWrm
                        gmvHariIni={gmv.gmvHariIni}
                        gmvKemarin={gmv.gmvKemarin}
                        targetHarian={gmv.targetHarian}
                        keputusan={keputusanWrm}
                        catatan={
                          lihatSemuaUnit
                            ? catatanRitme(
                                unit,
                                gmv.gmvHariIni,
                                gmv.targetHarian,
                              )
                            : undefined
                        }
                        disinkronPada={disinkronPada}
                      />
                    ),
                  },
                ]
              : []
          }
          tengah={[
            // Kartu ini hanya ada bila orangnya memang punya sasaran
            // laporan sendiri; `capaianPribadi` mengembalikan null kalau
            // tidak, dan kartu kosong lebih buruk daripada tidak ada.
            ...(tampil("capaianPribadi") && capaian
              ? [
                  {
                    kunci: "capaianPribadi" as const,
                    isi: (
                      <Reveal>
                        <KartuCapaianPribadi capaian={capaian} />
                      </Reveal>
                    ),
                  },
                ]
              : []),
            ...(tampil("targetBulanan")
              ? [
                  {
                    kunci: "targetBulanan" as const,
                    isi: (
                      <Reveal>
                        <TargetBulanan
                          unit={unit}
                          targetBulanan={gmv.targetBulanan}
                          sisaHari={gmv.sisaHariBulanIni}
                        />
                      </Reveal>
                    ),
                  },
                ]
              : []),
            ...(tampil("gmvUnit")
              ? [
                  {
                    kunci: "gmvUnit" as const,
                    isi: (
                      <Reveal>
                        <GmvPerUnit unit={unit} disinkronPada={disinkronPada} />
                      </Reveal>
                    ),
                  },
                ]
              : []),
          ]}
          kanan={[
            ...(tampil("statusTim")
              ? [
                  {
                    kunci: "statusTim" as const,
                    isi: (
                      <Reveal>
                        <StatusTim
                          totalStaf={kehadiran.total}
                          sudahAbsen={kehadiran.sudahAbsen}
                          wajibLapor={kehadiran.wajibLapor}
                          sudahLapor={kehadiran.sudahLapor}
                          telat={kehadiran.telat}
                          totalMenitTelat={kehadiran.totalMenitTelat}
                        />
                      </Reveal>
                    ),
                  },
                ]
              : []),
            ...(tampil("pantauKehadiran")
              ? [
                  {
                    kunci: "pantauKehadiran" as const,
                    isi: (
                      <Reveal>
                        <PantauKehadiran tim={kehadiran.tim} />
                      </Reveal>
                    ),
                  },
                ]
              : []),
          ]}
          kiri={[
            ...(tampil("toDo")
              ? [
                  {
                    kunci: "toDo" as const,
                    isi: (
                      <Reveal>
                        <ToDoHariIni todo={toDo} />
                      </Reveal>
                    ),
                  },
                ]
              : []),
            ...(tampil("tugas")
              ? [
                  {
                    kunci: "tugas" as const,
                    isi: (
                      <Reveal>
                        <TugasMendesak tugas={tugasMendesak} />
                      </Reveal>
                    ),
                  },
                ]
              : []),
            ...(tampil("posisiKas")
              ? [
                  {
                    kunci: "posisiKas" as const,
                    isi: (
                      <Reveal>
                        <PosisiKas ringkas={kas} />
                      </Reveal>
                    ),
                  },
                ]
              : []),
            ...(tampil("agenda")
              ? [
                  {
                    kunci: "agenda" as const,
                    isi: (
                      <Reveal>
                        <AgendaTerdekat daftar={agenda} hariIni={tanggal} />
                      </Reveal>
                    ),
                  },
                ]
              : []),
            ...(tampil("pengumuman")
              ? [
                  {
                    kunci: "pengumuman" as const,
                    isi: (
                      <Reveal varian="skala">
                        <KartuPengumuman
                          pengumuman={pengumuman}
                          hariIni={tanggal}
                        />
                      </Reveal>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>
    </AppShell>
  );
}
