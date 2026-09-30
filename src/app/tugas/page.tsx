import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PenyediaAksiTugas } from "@/components/tugas/aksi-tugas";
import { DaftarTugas } from "@/components/tugas/daftar-tugas";
import { PapanKanban } from "@/components/tugas/papan-kanban";
import {
  PilihTampilan,
  type TampilanTugas,
} from "@/components/tugas/pilih-tampilan";
import { DialogTiket } from "@/components/tugas/dialog-tiket";
import { DialogToDo } from "@/components/tugas/dialog-todo";
import { StripTanggal } from "@/components/tugas/strip-tanggal";
import { PesanAksi } from "@/components/shared/pesan-aksi";
import { Reveal } from "@/components/motion/reveal";
import {
  ambilDaftarTugas,
  ambilPapanSemua,
  ambilPapanTugas,
  hariIniTugas,
  jejakQcBanyak,
  ringkasToDo,
  sekarangTugas,
} from "@/lib/data/tugas";
import { goalAktif } from "@/lib/data/goal";
import { anggotaBisaDitugasi, peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { akhirPekan } from "@/lib/validasi-tugas";
import { SEMUA, pilihanPapanDariParam } from "@/lib/papan-tanggal";
import { bilangan } from "@/lib/format";

export const metadata: Metadata = {
  title: "Tugas — K-Space V2",
  description:
    "To-do pribadi dan tiket dari atasan dalam satu daftar, lengkap dengan QC.",
};

/** Peran yang boleh memeriksa hasil kerja orang lain. */
const PEMERIKSA = ["CEO", "Manager", "Leader", "Co-Leader"];

export default async function TugasPage({ searchParams }: PageProps<"/tugas">) {
  const {
    persona,
    tampilan: tampilanParam,
    tanggal: tanggalParam,
  } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  // Papan Kanban adalah tampilan bawaannya (PRD Fase 1); daftar
  // bertenggat tetap ada karena ia menjawab pertanyaan yang berbeda —
  // "mana yang paling mendesak", bukan "sedang di tahap mana".
  const tampilan: TampilanTugas =
    tampilanParam === "daftar" ? "daftar" : "papan";

  // Hari ini menurut WIB (D7), bukan UTC: antara 00.00 dan 06.59 WIB
  // tanggal UTC masih kemarin.
  const hariIni = hariIniTugas();
  const sekarang = sekarangTugas();
  // Papan bawaannya "Semua": semua yang belum selesai dari tanggal mana
  // pun, urut dari deadline terdekat. `?tanggal=` memilih satu tanggal
  // (`hari-ini` untuk hari ini). Daftar tetap mengelompokkan semua yang
  // belum selesai.
  const tanggal =
    tampilan === "papan" ? pilihanPapanDariParam(tanggalParam, hariIni) : SEMUA;
  const semua = tanggal === SEMUA;
  // Ringkasan to-do selalu per tanggal: papan Semua memakai hari ini.
  const tanggalRingkas = semua ? hariIni : tanggal;

  const [isi, calonPenerima, goal, ringkas] = await Promise.all([
    tampilan === "daftar"
      ? ambilDaftarTugas(pengguna, hariIni)
      : semua
        ? ambilPapanSemua(pengguna, hariIni)
        : ambilPapanTugas(pengguna, tanggal, hariIni),
    anggotaBisaDitugasi(pengguna),
    goalAktif(pengguna),
    ringkasToDo(pengguna, tanggalRingkas),
  ]);
  const { tugas } = isi;

  // Riwayat QC hanya diambil untuk tugas yang memang pernah diperiksa —
  // satu kueri untuk seluruh papan, bukan satu per kartu.
  const jejak = await jejakQcBanyak(
    tugas.filter((t) => t.qcStatus !== "belum").map((t) => t.id),
  );

  // Tugas baru selalu untuk hari ini atau sesudahnya — juga saat papan
  // sedang menampilkan tanggal lampau atau papan Semua.
  const tanggalBaru = !semua && tanggal > hariIni ? tanggal : hariIni;
  // Minggu dianggap berakhir Sabtu; tenggat bawaan komitmen.
  const sabtu = akhirPekan(hariIni);

  // Pilihan saringan asal tugas yang relevan untuk orang ini.
  const lingkup = {
    idSaya: pengguna.id,
    peran: pengguna.role,
    punyaAtasan: Boolean(pengguna.atasanId),
    bisaMemberiTiket: calonPenerima.length > 0,
    bolehQcSemua: PEMERIKSA.includes(pengguna.role),
    sekarang,
  };

  return (
    <AppShell pengguna={pengguna} halaman="Tugas">
      <div
        className={
          tampilan === "papan"
            ? "mx-auto w-full max-w-[1400px] space-y-4"
            : "mx-auto w-full max-w-3xl space-y-4"
        }
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Tugas
            </h1>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              To-do pribadi dan tiket dari atasan berkumpul di satu tempat.
              {ringkas.total > 0
                ? ` To-do ${tanggalRingkas === hariIni ? "hari ini" : "tanggal ini"}: ${ringkas.selesai} dari ${ringkas.total} beres.`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PilihTampilan tampilan={tampilan} />
            <DialogTiket
              penerima={calonPenerima}
              goal={goal}
              hariIni={hariIni}
              tanggalAwal={tanggalBaru}
              akhirPekan={sabtu}
            />
            <DialogToDo hariIni={hariIni} tanggalAwal={tanggalBaru} />
          </div>
        </div>

        {tampilan === "papan" ? (
          <StripTanggal tanggal={tanggal} hariIni={hariIni} />
        ) : null}

        {/* Batas aman tercapai: dikatakan, bukan dipotong diam-diam. */}
        {isi.terpotong ? (
          <PesanAksi nada="netral" ukuran="sedang">
            Menampilkan {bilangan(tugas.length)} tugas pertama dari{" "}
            {bilangan(isi.total)}
            {tampilan === "papan" && !semua ? " untuk tanggal ini" : ""}. Yang
            lainnya tidak dimuat.
          </PesanAksi>
        ) : null}

        <Reveal>
          {/* Edit & hapus dari kartu memakai dialog yang sama dengan tombol
              di atas, dengan daftar penerima & goal yang sama. */}
          <PenyediaAksiTugas
            penerima={calonPenerima}
            goal={goal}
            hariIni={hariIni}
            akhirPekan={sabtu}
          >
            {tampilan === "papan" ? (
              <PapanKanban
                tugas={tugas}
                {...lingkup}
                tanggal={tanggal}
                hariIni={hariIni}
                jejakQc={jejak}
              />
            ) : (
              <DaftarTugas
                tugas={tugas}
                {...lingkup}
                hariIni={hariIni}
                jejakQc={jejak}
              />
            )}
          </PenyediaAksiTugas>
        </Reveal>
      </div>
    </AppShell>
  );
}
