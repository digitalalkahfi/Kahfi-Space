import {
  Building2,
  ChevronUp,
  Mail,
  Network,
  Store,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen, rupiahRingkas } from "@/lib/format";
import { gayaPredikatKpi } from "@/lib/unit";
import { LencanaPredikat } from "@/components/grd/lencana-predikat";
import { LencanaStatus } from "@/components/tim/lencana-status";
import { TombolStatusAnggota } from "@/components/tim/tombol-status-anggota";
import { LABEL_SUMBER } from "@/lib/kpi";
import type { BarisScorecard } from "@/lib/kpi";
import type { AkunKelola } from "@/lib/data/akun";
import type { AnggotaTim, MataRantai } from "@/lib/types";

/** Kepala profil: siapa orang ini dan di mana tempatnya. */
export function KepalaProfil({
  anggota,
  bolehKelola,
}: {
  anggota: AnggotaTim;
  bolehKelola: boolean;
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start gap-4 px-5">
        <Avatar className="size-14 shrink-0">
          <AvatarFallback className="bg-primary text-base font-bold text-primary-foreground">
            {anggota.inisial}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-[22px] leading-7 font-bold tracking-tight">
            {anggota.nama}
            <LencanaStatus status={anggota.status} />
          </h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {anggota.jabatan}
          </p>

          <dl className="mt-2 space-y-1 text-[11px] leading-[16px] text-muted-foreground">
            {anggota.email ? (
              <div className="flex items-center gap-1.5">
                <Mail className="size-3 shrink-0" />
                <dd className="truncate">{anggota.email}</dd>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              <Building2 className="size-3 shrink-0" />
              <dd className="truncate">
                {anggota.unitNama}
                {anggota.program ? ` · ${anggota.program}` : ""}
                {anggota.departemen ? ` · dep. ${anggota.departemen}` : ""}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <UserRound className="size-3 shrink-0" />
              <dd className="truncate">
                {anggota.atasanNama
                  ? `Melapor ke ${anggota.atasanNama}`
                  : "Belum punya atasan"}
              </dd>
            </div>
          </dl>

          {bolehKelola ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <TombolStatusAnggota anggota={anggota} gaya="penuh" />
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/** Garis pelaporan ke atas dan siapa saja yang melapor kepadanya. */
export function GarisPelaporan({
  rantai,
  bawahanLangsung,
}: {
  rantai: MataRantai[];
  bawahanLangsung: AnggotaTim[];
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <h2 className="flex items-center gap-2 px-5 text-base leading-6 font-semibold">
        <Network className="size-4 text-muted-foreground" />
        Garis pelaporan
      </h2>

      <div className="space-y-3 px-5">
        <div>
          <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Melapor ke atas
          </p>
          {rantai.length === 0 ? (
            <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
              Belum ada atasan yang ditetapkan.
            </p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {rantai.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center gap-1.5 text-[13px] leading-[18px]"
                  style={{ paddingLeft: `${(m.tingkat - 1) * 12}px` }}
                >
                  <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{m.nama}</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {m.jabatan}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Melapor kepadanya
          </p>
          {bawahanLangsung.length === 0 ? (
            <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
              Belum ada yang melapor kepadanya.
            </p>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {bawahanLangsung.map((b) => (
                <li
                  key={b.id}
                  className="rounded-full bg-muted px-2.5 py-1 text-[11px] leading-[14px] font-medium"
                >
                  {b.nama}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Akun yang ia pegang sebagai PIC, beserta capaian periodenya. */
export function AkunDipegang({ daftar }: { daftar: AkunKelola[] }) {
  if (daftar.length === 0) return null;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <h2 className="flex items-center gap-2 px-5 text-base leading-6 font-semibold">
        <Store className="size-4 text-muted-foreground" />
        Akun yang dipegang
      </h2>

      <ul className="space-y-2 px-5">
        {daftar.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] leading-[18px] font-semibold">
                {a.username}
              </span>
              <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                {a.unitNama}
                {a.program && a.program !== "Reguler" ? ` · ${a.program}` : ""}
              </span>
            </span>
            <span className="tabular shrink-0 text-right">
              <span className="block text-[13px] leading-[18px] font-semibold">
                {rupiahRingkas(a.gmvPeriode)}
              </span>
              <span className="block text-[11px] leading-[14px] text-muted-foreground">
                GMV bulan ini
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Skor KPI bulan berjalan beserta rincian indikatornya. */
export function KpiAnggota({
  baris,
  bulanLabel,
}: {
  baris: BarisScorecard | null;
  bulanLabel: string;
}) {
  if (!baris) return null;

  const gaya = gayaPredikatKpi[baris.predikat];

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            KPI {bulanLabel}
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            skala 1.000
            {baris.terkunci ? " · sudah dikunci" : ""}
            {baris.cakupan < 100
              ? ` · ${persen(baris.cakupan, 0)} bobot terukur`
              : ""}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span
            className={cn(
              "tabular block text-2xl leading-[30px] font-bold tracking-tight",
              gaya.teks,
            )}
          >
            {Math.round(baris.skor)}
          </span>
          <LencanaPredikat predikat={baris.predikat} ukuran="kecil" />
        </span>
      </div>

      <ul className="space-y-1.5 px-5">
        {baris.rincian.map((r) => (
          <li
            key={r.nama}
            className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] leading-[18px] font-medium">
                {r.nama}
              </span>
              <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                {LABEL_SUMBER[r.sumber]} · bobot {persen(r.bobot, 0)}
              </span>
            </span>
            <span className="tabular shrink-0 text-right">
              <span
                className={cn(
                  "block text-[13px] leading-[18px] font-semibold",
                  !r.berlaku && "text-muted-foreground",
                )}
              >
                {r.berlaku && r.skor !== null ? Math.round(r.skor) : "—"}
              </span>
              <span className="block text-[11px] leading-[14px] text-muted-foreground">
                {r.berlaku && r.realisasi !== null
                  ? persen(r.realisasi)
                  : "tidak berlaku"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
