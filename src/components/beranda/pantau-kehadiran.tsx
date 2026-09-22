"use client";

import { useMemo, useState } from "react";
import { BellRing, Check, UsersRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { jamWib } from "@/lib/format";
import type { AnggotaKehadiran, StatusAbsen } from "@/lib/types";

const labelStatus: Record<StatusAbsen, { teks: string; kelas: string }> = {
  hadir: { teks: "Hadir", kelas: "text-ok-text" },
  terlambat: { teks: "Terlambat", kelas: "text-warn-text" },
  izin: { teks: "Izin (disetujui)", kelas: "text-info-text" },
  sakit: { teks: "Sakit (disetujui)", kelas: "text-info-text" },
  belum_absen: { teks: "Belum absen", kelas: "text-danger-text" },
};

type Saringan = "belum_absen" | "belum_lapor";

/**
 * "Pantau Kehadiran" (PRD §3 Beranda): siapa yang belum absen dan siapa yang
 * belum kirim laporan harian, lengkap dengan tombol ingatkan per orang.
 */
export function PantauKehadiran({ tim }: { tim: AnggotaKehadiran[] }) {
  const [saringan, setSaringan] = useState<Saringan>("belum_lapor");
  const [diingatkan, setDiingatkan] = useState<string[]>([]);

  const { belumAbsen, belumLapor, sudahAbsen } = useMemo(() => {
    const hadir = tim.filter(
      (a) => a.statusAbsen === "hadir" || a.statusAbsen === "terlambat",
    );
    return {
      sudahAbsen: hadir.length,
      belumAbsen: tim.filter(
        (a) => a.statusAbsen !== "hadir" && a.statusAbsen !== "terlambat",
      ),
      // Hanya yang memang punya sasaran laporan yang pantas ditagih.
      belumLapor: hadir.filter((a) => a.wajibLapor && !a.sudahLapor),
    };
  }, [tim]);

  const daftar = saringan === "belum_absen" ? belumAbsen : belumLapor;

  // Izin & sakit sudah disetujui atasan — tidak perlu ditagih.
  const perluDitagih = daftar.filter(
    (a) => a.statusAbsen !== "izin" && a.statusAbsen !== "sakit",
  );
  const semuaDiingatkan =
    perluDitagih.length > 0 &&
    perluDitagih.every((a) => diingatkan.includes(a.id));

  const ingatkan = (id: string) =>
    setDiingatkan((s) => (s.includes(id) ? s : [...s, id]));

  const ingatkanSemua = () =>
    setDiingatkan((s) => [
      ...s,
      ...perluDitagih.map((a) => a.id).filter((id) => !s.includes(id)),
    ]);

  const tab: { kunci: Saringan; label: string; jumlah: number }[] = [
    { kunci: "belum_lapor", label: "Belum lapor", jumlah: belumLapor.length },
    { kunci: "belum_absen", label: "Belum absen", jumlah: belumAbsen.length },
  ];

  return (
    <Card className="kartu-interaktif ring-border-subtle rounded-3xl shadow-card">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Pantau Kehadiran
          </h2>
          <p className="tabular text-[13px] leading-[18px] text-muted-foreground">
            {sudahAbsen} dari {tim.length} staf telah check-in
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <UsersRound className="size-4" />
        </span>
      </div>

      <div className="px-5">
        <div
          role="tablist"
          aria-label="Saring kehadiran"
          className="inline-flex items-center gap-1 rounded-full bg-muted p-1"
        >
          {tab.map((t) => {
            const aktif = t.kunci === saringan;
            return (
              <button
                key={t.kunci}
                type="button"
                role="tab"
                aria-selected={aktif}
                onClick={() => setSaringan(t.kunci)}
                className={cn(
                  "tekan-halus sentuh-nyaman flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold",
                  aktif
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "tabular rounded-full px-1.5 text-[10px] leading-[14px]",
                    aktif
                      ? "bg-primary-foreground/20"
                      : "bg-card text-muted-foreground",
                  )}
                >
                  {t.jumlah}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {daftar.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-ok-text">
          {saringan === "belum_lapor"
            ? "Semua laporan harian sudah masuk."
            : "Seluruh tim sudah absen hari ini."}
        </p>
      ) : (
        <ScrollArea className="max-h-[17rem] px-5">
          <ul className="space-y-1 pr-2">
            {daftar.map((a) => {
              const status = labelStatus[a.statusAbsen];
              const sudah = diingatkan.includes(a.id);
              const bisaDitagih =
                a.statusAbsen !== "izin" && a.statusAbsen !== "sakit";
              return (
                <li
                  key={a.id}
                  className="baris-interaktif flex items-center gap-3 rounded-2xl px-1 py-2"
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="bg-muted text-[11px] font-semibold text-muted-foreground">
                      {a.inisial}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm leading-5 font-semibold">
                      {a.nama}
                    </p>
                    <p className="truncate text-[11px] leading-[14px]">
                      <span className={status.kelas}>{status.teks}</span>
                      <span className="text-muted-foreground">
                        {a.jamMasuk ? ` ${jamWib(a.jamMasuk)}` : ""} · {a.unit}
                      </span>
                    </p>
                  </div>

                  {bisaDitagih ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={sudah}
                      onClick={() => ingatkan(a.id)}
                      className="tekan-halus sentuh-nyaman h-7 shrink-0 rounded-full px-3 text-[11px] font-semibold"
                    >
                      {sudah ? <Check className="size-3" /> : null}
                      {sudah ? "Terkirim" : "Ingatkan"}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}

      {perluDitagih.length > 0 ? (
        <div className="px-5">
          <Button
            type="button"
            onClick={ingatkanSemua}
            disabled={semuaDiingatkan}
            className={cn(
              "tekan-halus h-11 w-full rounded-full text-[13px] font-semibold",
              semuaDiingatkan && "bg-ok-fill text-ok-text hover:bg-ok-fill",
            )}
          >
            {semuaDiingatkan ? (
              <>
                <Check className="size-4" />
                Notifikasi terkirim ke {perluDitagih.length} staf
              </>
            ) : (
              <>
                <BellRing className="size-4" />
                Ingatkan {perluDitagih.length} staf
              </>
            )}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
