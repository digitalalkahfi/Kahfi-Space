import { Medal, Store, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LencanaPredikat } from "@/components/grd/lencana-predikat";
import { cn } from "@/lib/utils";
import { persen, rupiahRingkas } from "@/lib/format";
import {
  KELOMPOK_PAPAN,
  kelompokkanPapan,
  type BarisPapanAkun,
  type BarisPapanKpi,
} from "@/lib/papan";

const ANGKA = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

function TandaPeringkat({ peringkat }: { peringkat: number }) {
  const juara = peringkat <= 3;
  return (
    <span
      className={cn(
        "tabular flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] leading-[18px] font-bold",
        peringkat === 1 && "bg-warn-fill text-warn-text",
        peringkat === 2 && "bg-muted text-foreground ring-1 ring-border-subtle",
        peringkat === 3 && "bg-accentmuted-fill text-accentmuted-text",
        !juara && "text-muted-foreground",
      )}
      aria-label={`Peringkat ${peringkat}`}
    >
      {juara ? <Medal className="size-4" aria-hidden /> : peringkat}
    </span>
  );
}

function BarisOrang({ b, saya }: { b: BarisPapanKpi; saya: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5",
        saya ? "bg-info-fill/60 ring-1 ring-info-text/20" : "bg-muted/50",
      )}
    >
      <TandaPeringkat peringkat={b.peringkat} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] leading-[18px] font-semibold">
          {b.nama}
          {saya ? (
            <span className="ml-1.5 text-[11px] font-medium text-info-text">
              (kamu)
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
          {b.jabatan || b.unit}
          {b.predikat !== null && b.cakupan < 100
            ? ` · terisi ${persen(b.cakupan, 0)}`
            : ""}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="tabular block text-[15px] leading-5 font-bold">
          {b.predikat === null ? "—" : ANGKA.format(b.skor)}
        </span>
        <LencanaPredikat predikat={b.predikat} ukuran="kecil" />
      </span>
    </li>
  );
}

/**
 * Leaderboard NILAI KPI per level. Tiap level diperingkat sendiri —
 * staf dibandingkan dengan staf, leader dengan leader.
 */
export function PapanKpi({
  daftar,
  penggunaId,
}: {
  daftar: BarisPapanKpi[];
  penggunaId: string;
}) {
  const kelompok = kelompokkanPapan(daftar);

  if (daftar.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <Trophy className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-[13px] leading-[18px] font-semibold">
            Belum ada lembar KPI GRD bulan ini
          </p>
          <p className="max-w-sm text-[13px] leading-[18px] text-muted-foreground">
            Leaderboard muncul setelah lembar KPI per orang disahkan.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {KELOMPOK_PAPAN.map((k) => (
        <Card
          key={k.kunci}
          className="rounded-3xl shadow-card ring-border-subtle"
        >
          <div className="px-5">
            <h2 className="text-base leading-6 font-semibold">{k.judul}</h2>
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              {k.ringkas}
            </p>
          </div>
          <ol className="space-y-1.5 px-3">
            {kelompok[k.kunci].length === 0 ? (
              <li className="px-2 py-3 text-[13px] leading-[18px] text-muted-foreground">
                Belum ada lembar KPI di level ini.
              </li>
            ) : (
              kelompok[k.kunci].map((b) => (
                <BarisOrang
                  key={b.userId}
                  b={b}
                  saya={b.userId === penggunaId}
                />
              ))
            )}
          </ol>
        </Card>
      ))}
    </div>
  );
}

/** Papan akun: % capaian target GMV bulan ini, tertinggi di atas. */
export function PapanAkun({ daftar }: { daftar: BarisPapanAkun[] }) {
  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <Store className="size-4 text-muted-foreground" aria-hidden />
          Papan akun
        </h2>
        <p className="text-[11px] leading-[14px] text-muted-foreground">
          % capaian target GMV akun. Akun Manager dan CEO tidak ikut, sesuai
          file GRD.
        </p>
      </div>
      {daftar.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada target akun bulan ini.
        </p>
      ) : (
        <ol className="space-y-1.5 px-3">
          {daftar.map((a) => {
            const lebar = Math.max(0, Math.min(100, a.persen ?? 0));
            return (
              <li
                key={a.accountId}
                className="flex items-center gap-3 rounded-2xl bg-muted/50 px-3 py-2.5"
              >
                <TandaPeringkat peringkat={a.peringkat} />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] leading-[18px] font-semibold">
                      {a.username}
                    </span>
                    <span className="tabular shrink-0 text-[13px] leading-[18px] font-bold">
                      {a.persen === null ? "—" : persen(a.persen, 1)}
                    </span>
                  </span>
                  <span
                    className="block h-1.5 overflow-hidden rounded-full bg-card"
                    aria-hidden
                  >
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        (a.persen ?? 0) >= 100 ? "bg-ok-text" : "bg-primary",
                      )}
                      style={{ width: `${lebar}%` }}
                    />
                  </span>
                  <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                    {[a.pemegang, a.unit].filter(Boolean).join(" · ")}
                    {a.realisasi !== null && a.target !== null
                      ? ` · ${rupiahRingkas(a.realisasi)} dari ${rupiahRingkas(a.target)}`
                      : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
