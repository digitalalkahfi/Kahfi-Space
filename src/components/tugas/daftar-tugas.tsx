"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AlarmClock, ListChecks } from "lucide-react";
import { KartuTugas } from "@/components/tugas/kartu-tugas";
import { SaringSumber } from "@/components/tugas/saring-sumber";
import { cn } from "@/lib/utils";
import { keTanggalWib } from "@/lib/format";
import { geserTanggal } from "@/lib/validasi-tugas";
import {
  cocokLihat,
  hitungLihat,
  lihatDariParam,
  pilihanLihat,
} from "@/lib/sumber-tugas";
import type { JejakQc } from "@/lib/data/tugas";
import type { Peran, Tugas } from "@/lib/types";
import { KeadaanKosong } from "@/components/shared/keadaan";

const BOBOT = { tinggi: 0, sedang: 1, rendah: 2 } as const;

type Kelompok = "terlambat" | "hari-ini" | "besok" | "nanti" | "tanpa-tenggat";

const JUDUL_KELOMPOK: Record<Kelompok, string> = {
  terlambat: "Lewat tenggat",
  "hari-ini": "Hari ini",
  besok: "Besok",
  nanti: "Nanti",
  "tanpa-tenggat": "Tanpa tenggat",
};

const URUTAN: Kelompok[] = [
  "terlambat",
  "hari-ini",
  "besok",
  "nanti",
  "tanpa-tenggat",
];

/**
 * Mengelompokkan berdasarkan tenggat relatif terhadap hari berjalan —
 * tanggal tenggatnya dibaca di WIB, sama dengan `kelompok_tenggat_dari`.
 */
function kelompokTenggat(tenggat: string, hariIni: string): Kelompok {
  if (!tenggat) return "tanpa-tenggat";
  const hari = keTanggalWib(tenggat);
  if (hari < hariIni) return "terlambat";
  if (hari === hariIni) return "hari-ini";
  return hari === geserTanggal(hariIni, 1) ? "besok" : "nanti";
}

/**
 * Daftar tugas dengan saringan. Urutannya mengikuti yang paling menuntut
 * perhatian: belum selesai dulu, lalu prioritas, lalu tenggat terdekat.
 *
 * Saringannya sama dengan papan (asal tugas: to-do pribadi, dari atasan,
 * untuk bawahan, tim lain), ditambah "Perlu QC". Tidak ada "Selesai":
 * daftar ini hanya memuat yang belum selesai; yang sudah beres ada di
 * kolom Selesai papan, per tanggal.
 */
export function DaftarTugas({
  tugas,
  idSaya,
  peran,
  punyaAtasan,
  bisaMemberiTiket,
  bolehQcSemua,
  hariIni,
  jejakQc = {},
}: {
  tugas: Tugas[];
  /** Id pengguna yang login — kepemilikan dibandingkan lewat id, bukan nama. */
  idSaya: string;
  peran: Peran;
  /** Punya atasan langsung — pilihan "Dari atasan" relevan. */
  punyaAtasan: boolean;
  /** Ada anggota yang boleh ia tugasi — pilihan "Untuk bawahan" relevan. */
  bisaMemberiTiket: boolean;
  /** CEO/Manager/Leader boleh memeriksa tugas orang lain. */
  bolehQcSemua: boolean;
  hariIni: string;
  /** Riwayat pemeriksaan per id tugas. */
  jejakQc?: Record<string, JejakQc[]>;
}) {
  const params = useSearchParams();
  const belum = useMemo(
    () => tugas.filter((t) => t.status !== "selesai"),
    [tugas],
  );
  const jumlah = useMemo(() => hitungLihat(belum, idSaya), [belum, idSaya]);
  const pilihan = pilihanLihat({
    peran,
    punyaAtasan,
    bisaMemberiTiket,
    jumlah,
    denganQc: true,
  });
  const saringan = lihatDariParam(params.get("lihat"), pilihan);

  const daftar = useMemo(() => {
    const cocok = belum.filter((t) => cocokLihat(t, saringan, idSaya));

    return cocok.sort((a, b) => {
      const p = BOBOT[a.prioritas] - BOBOT[b.prioritas];
      if (p !== 0) return p;
      return (a.tenggat || "9999").localeCompare(b.tenggat || "9999");
    });
  }, [belum, saringan, idSaya]);

  // Dikelompokkan per tenggat supaya yang mendesak tidak tenggelam.
  const berkelompok = useMemo(() => {
    const hasil = {} as Record<Kelompok, Tugas[]>;
    for (const t of daftar) {
      const k = kelompokTenggat(t.tenggat, hariIni);
      (hasil[k] ??= []).push(t);
    }
    return hasil;
  }, [daftar, hariIni]);

  // Dihitung dari yang sedang disaring: angkanya harus cocok dengan
  // kelompok "Lewat tenggat" di bawahnya.
  const terlambat = useMemo(
    () =>
      daftar.filter((t) => kelompokTenggat(t.tenggat, hariIni) === "terlambat")
        .length,
    [daftar, hariIni],
  );

  return (
    <div className="space-y-4">
      <SaringSumber pilihan={pilihan} aktif={saringan} jumlah={jumlah} />

      {terlambat > 0 ? (
        <p className="flex items-center gap-2 rounded-2xl bg-danger-fill px-4 py-2.5 text-[13px] leading-[18px] font-semibold text-danger-text">
          <AlarmClock className="size-4 shrink-0" />
          {terlambat} tugas sudah lewat tenggat
        </p>
      ) : null}

      {daftar.length === 0 ? (
        <KeadaanKosong
          ikon={<ListChecks className="size-4" />}
          judul="Tidak ada tugas di saringan ini"
          pesan="Nikmati sebentar — atau longgarkan saringan untuk melihat tugas lain. Yang sudah selesai ada di papan, kolom Selesai per tanggal."
        />
      ) : (
        <div className="space-y-5">
          {URUTAN.filter((k) => berkelompok[k]?.length).map((k) => (
            <section key={k} className="space-y-2.5">
              <h2
                className={cn(
                  "text-[11px] leading-[14px] font-semibold tracking-[0.06em] uppercase",
                  k === "terlambat"
                    ? "text-danger-text"
                    : "text-muted-foreground",
                )}
              >
                {JUDUL_KELOMPOK[k]} · {berkelompok[k].length}
              </h2>
              <ul className="space-y-2.5">
                {berkelompok[k].map((t) => (
                  <li key={t.id}>
                    <KartuTugas
                      tugas={t}
                      sayaPenerima={t.penerimaId === idSaya}
                      sayaPembuat={t.pembuatId === idSaya}
                      bolehQc={
                        t.tipe !== "pribadi" &&
                        (bolehQcSemua || t.pembuatId === idSaya)
                      }
                      hariIni={hariIni}
                      jejakQc={jejakQc[t.id]}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
