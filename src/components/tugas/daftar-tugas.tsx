"use client";

import { useMemo, useState } from "react";
import { AlarmClock, ListChecks } from "lucide-react";
import { KartuTugas } from "@/components/tugas/kartu-tugas";
import { cn } from "@/lib/utils";
import type { Tugas } from "@/lib/types";
import { KeadaanKosong } from "@/components/shared/keadaan";

type Saringan = "semua" | "saya" | "tiket" | "komitmen" | "qc" | "selesai";

const PILIHAN: { kunci: Saringan; label: string }[] = [
  { kunci: "semua", label: "Semua" },
  { kunci: "saya", label: "To-do saya" },
  { kunci: "tiket", label: "Tiket" },
  { kunci: "komitmen", label: "Komitmen" },
  { kunci: "qc", label: "Perlu QC" },
  { kunci: "selesai", label: "Selesai" },
];

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

/** Mengelompokkan berdasarkan tenggat relatif terhadap hari berjalan. */
function kelompokTenggat(tenggat: string, hariIni: string): Kelompok {
  if (!tenggat) return "tanpa-tenggat";
  const hari = tenggat.slice(0, 10);
  if (hari < hariIni) return "terlambat";
  if (hari === hariIni) return "hari-ini";

  const besok = new Date(`${hariIni}T00:00:00Z`);
  besok.setUTCDate(besok.getUTCDate() + 1);
  return hari === besok.toISOString().slice(0, 10) ? "besok" : "nanti";
}

/**
 * Daftar tugas dengan saringan. Urutannya mengikuti yang paling menuntut
 * perhatian: belum selesai dulu, lalu prioritas, lalu tenggat terdekat.
 */
export function DaftarTugas({
  tugas,
  namaSaya,
  bolehQcSemua,
  hariIni,
}: {
  tugas: Tugas[];
  namaSaya: string;
  /** CEO/Manager/Leader boleh memeriksa tugas orang lain. */
  bolehQcSemua: boolean;
  hariIni: string;
}) {
  const [saringan, setSaringan] = useState<Saringan>("semua");

  const jumlah = useMemo(
    () => ({
      semua: tugas.filter((t) => t.status !== "selesai").length,
      saya: tugas.filter((t) => t.tipe === "pribadi" && t.status !== "selesai")
        .length,
      tiket: tugas.filter((t) => t.tipe === "tiket" && t.status !== "selesai")
        .length,
      komitmen: tugas.filter(
        (t) => t.tipe === "komitmen_mingguan" && t.status !== "selesai",
      ).length,
      qc: tugas.filter((t) => t.status === "menunggu_qc").length,
      selesai: tugas.filter((t) => t.status === "selesai").length,
    }),
    [tugas],
  );

  const daftar = useMemo(() => {
    const cocok = tugas.filter((t) => {
      switch (saringan) {
        case "saya":
          return t.tipe === "pribadi" && t.status !== "selesai";
        case "tiket":
          return t.tipe === "tiket" && t.status !== "selesai";
        case "komitmen":
          return t.tipe === "komitmen_mingguan" && t.status !== "selesai";
        case "qc":
          return t.status === "menunggu_qc";
        case "selesai":
          return t.status === "selesai";
        default:
          return t.status !== "selesai";
      }
    });

    return cocok.sort((a, b) => {
      const p = BOBOT[a.prioritas] - BOBOT[b.prioritas];
      if (p !== 0) return p;
      return (a.tenggat || "9999").localeCompare(b.tenggat || "9999");
    });
  }, [tugas, saringan]);

  // Dikelompokkan per tenggat supaya yang mendesak tidak tenggelam.
  const berkelompok = useMemo(() => {
    const hasil = {} as Record<Kelompok, Tugas[]>;
    for (const t of daftar) {
      const k = kelompokTenggat(t.tenggat, hariIni);
      (hasil[k] ??= []).push(t);
    }
    return hasil;
  }, [daftar, hariIni]);

  const terlambat = useMemo(
    () =>
      tugas.filter(
        (t) =>
          t.status !== "selesai" &&
          kelompokTenggat(t.tenggat, hariIni) === "terlambat",
      ).length,
    [tugas, hariIni],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {PILIHAN.map((p) => (
          <button
            key={p.kunci}
            type="button"
            onClick={() => setSaringan(p.kunci)}
            aria-pressed={p.kunci === saringan}
            className={cn(
              "tekan-halus sentuh-nyaman flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold",
              p.kunci === saringan
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
            )}
          >
            {p.label}
            <span
              className={cn(
                "tabular rounded-full px-1.5 text-[10px] leading-[14px]",
                p.kunci === saringan
                  ? "bg-primary-foreground/20"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {jumlah[p.kunci]}
            </span>
          </button>
        ))}
      </div>

      {terlambat > 0 && saringan !== "selesai" ? (
        <p className="flex items-center gap-2 rounded-2xl bg-danger-fill px-4 py-2.5 text-[13px] leading-[18px] font-semibold text-danger-text">
          <AlarmClock className="size-4 shrink-0" />
          {terlambat} tugas sudah lewat tenggat
        </p>
      ) : null}

      {daftar.length === 0 ? (
        <KeadaanKosong
          ikon={<ListChecks className="size-4" />}
          judul={
            saringan === "selesai"
              ? "Belum ada tugas yang selesai"
              : "Tidak ada tugas di saringan ini"
          }
          pesan={
            saringan === "selesai"
              ? "Tugas pindah ke sini begitu ditandai selesai."
              : "Nikmati sebentar — atau longgarkan saringan untuk melihat tugas lain."
          }
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
                      sayaPenerima={t.penerimaLengkap === namaSaya}
                      bolehQc={
                        t.tipe !== "pribadi" &&
                        (bolehQcSemua ||
                          t.pembuat.startsWith(namaSaya.split(" ")[0]))
                      }
                      hariIni={hariIni}
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
