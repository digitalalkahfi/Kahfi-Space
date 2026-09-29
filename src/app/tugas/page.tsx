import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DaftarTugas } from "@/components/tugas/daftar-tugas";
import { PapanKanban } from "@/components/tugas/papan-kanban";
import {
  PilihTampilan,
  type TampilanTugas,
} from "@/components/tugas/pilih-tampilan";
import { DialogTiket } from "@/components/tugas/dialog-tiket";
import { DialogToDo } from "@/components/tugas/dialog-todo";
import { Reveal } from "@/components/motion/reveal";
import {
  ambilSemuaTugas,
  hariIniTugas,
  jejakQcBanyak,
  ringkasToDo,
} from "@/lib/data/tugas";
import { goalAktif } from "@/lib/data/goal";
import { anggotaBisaDitugasi, peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { akhirPekan } from "@/lib/validasi-tugas";

export const metadata: Metadata = {
  title: "Tugas — K-Space V2",
  description:
    "To-do pribadi dan tiket dari atasan dalam satu daftar, lengkap dengan QC.",
};

/** Peran yang boleh memeriksa hasil kerja orang lain. */
const PEMERIKSA = ["CEO", "Manager", "Leader", "Co-Leader"];

export default async function TugasPage({ searchParams }: PageProps<"/tugas">) {
  const { persona, tampilan: tampilanParam } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  // Papan Kanban adalah tampilan bawaannya (PRD Fase 1); daftar
  // bertenggat tetap ada karena ia menjawab pertanyaan yang berbeda —
  // "mana yang paling mendesak", bukan "sedang di tahap mana".
  const tampilan: TampilanTugas =
    tampilanParam === "daftar" ? "daftar" : "papan";

  // Hari ini menurut WIB (D7), bukan UTC: antara 00.00 dan 06.59 WIB
  // tanggal UTC masih kemarin.
  const tanggal = hariIniTugas();

  const [tugas, calonPenerima, goal, ringkas] = await Promise.all([
    ambilSemuaTugas(pengguna),
    anggotaBisaDitugasi(pengguna),
    goalAktif(pengguna),
    ringkasToDo(pengguna),
  ]);

  // Riwayat QC hanya diambil untuk tugas yang memang pernah diperiksa —
  // satu kueri untuk seluruh papan, bukan satu per kartu.
  const jejak = await jejakQcBanyak(
    tugas.filter((t) => t.qcStatus !== "belum").map((t) => t.id),
  );


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
                ? ` To-do kamu: ${ringkas.selesai} dari ${ringkas.total} beres.`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PilihTampilan tampilan={tampilan} />
            <DialogTiket
              penerima={calonPenerima}
              goal={goal}
              hariIni={tanggal}
              tanggalAwal={tanggal}
              // Minggu dianggap berakhir Sabtu; tenggat bawaan komitmen.
              akhirPekan={akhirPekan(tanggal)}
            />
            <DialogToDo hariIni={tanggal} tanggalAwal={tanggal} />
          </div>
        </div>

        <Reveal>
          {tampilan === "papan" ? (
            <PapanKanban
              tugas={tugas}
              idSaya={pengguna.id}
              bolehQcSemua={PEMERIKSA.includes(pengguna.role)}
              hariIni={tanggal}
              jejakQc={jejak}
            />
          ) : (
            <DaftarTugas
              tugas={tugas}
              idSaya={pengguna.id}
              bolehQcSemua={PEMERIKSA.includes(pengguna.role)}
              hariIni={tanggal}
              jejakQc={jejak}
            />
          )}
        </Reveal>
      </div>
    </AppShell>
  );
}
