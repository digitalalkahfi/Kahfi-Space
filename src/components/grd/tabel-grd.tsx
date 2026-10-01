import Link from "next/link";
import { Table2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  KOLOM_BLOK,
  LABEL_STATUS_BARIS,
  rentangBlok,
  statusBaris,
  type BlokSel,
  type KolomBlok,
  type StatusBaris,
  type TabelGrd as DataTabelGrd,
} from "@/lib/tabel-grd";
import type { JenisRencana } from "@/lib/rencana";

const JUDUL_KOLOM: Record<KolomBlok, string> = {
  perusahaan: "Goal Perusahaan",
  manager: "Strategic Plan = Goal Manager",
  leader: "Tactical Plan = Goal Leader",
};

/** Latar sangat tipis per level, supaya jenjangnya terbaca tanpa ramai. */
const LATAR_BLOK: Record<KolomBlok, string> = {
  perusahaan: "bg-info-fill/70",
  manager: "bg-accentmuted-fill/60",
  leader: "bg-ok-fill/50",
};

const GAYA_JENIS: Record<JenisRencana, string> = {
  sekali: "bg-warn-fill text-warn-text",
  harian: "bg-ok-fill text-ok-text",
  pekanan: "bg-info-fill text-info-text",
};

const GAYA_STATUS: Record<StatusBaris, string> = {
  belum: "bg-muted text-muted-foreground",
  berjalan: "bg-info-fill text-info-text",
  selesai: "bg-ok-fill text-ok-text",
  terlambat: "bg-danger-fill text-danger-text",
};

const LEBAR = {
  perusahaan: "w-[220px] min-w-[220px]",
  manager: "w-[220px] min-w-[220px]",
  leader: "w-[240px] min-w-[240px]",
  kode: "w-[84px] min-w-[84px]",
  rencana: "w-[340px] min-w-[340px]",
  jenis: "w-[96px] min-w-[96px]",
  siapa: "w-[140px] min-w-[140px]",
  kapan: "w-[140px] min-w-[140px]",
  status: "w-[132px] min-w-[132px]",
};

function SelBlok({
  blok,
  kolom,
  rentang,
}: {
  blok: BlokSel | null;
  kolom: KolomBlok;
  rentang: number;
}) {
  return (
    <td
      rowSpan={rentang}
      className={cn(
        "border-r border-b border-border-subtle px-3 py-2.5 align-top",
        LATAR_BLOK[kolom],
      )}
    >
      {blok ? (
        <div className="sticky top-12 space-y-1.5">
          {blok.kode ? (
            <span className="tabular inline-block rounded-md bg-card px-1.5 py-0.5 text-[11px] leading-[14px] font-bold ring-1 ring-border-subtle">
              {blok.kode}
            </span>
          ) : null}
          {blok.teks ? (
            <p className="text-[12px] leading-[17px] font-medium whitespace-pre-line">
              {blok.teks}
            </p>
          ) : null}
          {blok.label ? (
            <p className="text-[10px] leading-[14px] font-semibold tracking-wide text-muted-foreground uppercase">
              {blok.label}
            </p>
          ) : null}
        </div>
      ) : null}
    </td>
  );
}

/**
 * Tabel GRD — susunan sheet "GRD Cascade": Goal Perusahaan → Goal
 * Manager → Goal Leader → Operational Plan, JENIS, SIAPA, KAPAN, STATUS.
 * Sel tiap level digabung (rowspan) seperti spreadsheet; teksnya apa
 * adanya dari data, tanpa diringkas.
 */
export function TabelGrd({
  tabel,
  hariIni,
}: {
  tabel: DataTabelGrd;
  hariIni: string;
}) {
  if (tabel.baris.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <Table2 className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-[13px] leading-[18px] font-semibold">
            Belum ada GRD Cascade bulan ini
          </p>
          <p className="max-w-sm text-[13px] leading-[18px] text-muted-foreground">
            Tabel terisi setelah file GRD bulanan diimpor.
          </p>
        </div>
      </Card>
    );
  }

  const rentang = rentangBlok(tabel.baris);
  const th =
    "sticky top-0 z-10 border-b border-border-subtle bg-card px-3 py-2.5 text-left align-bottom text-[10px] leading-[14px] font-bold tracking-wide text-muted-foreground uppercase";

  return (
    <Card className="gap-0 overflow-hidden rounded-3xl py-0 shadow-card ring-border-subtle">
      {tabel.judul ? (
        <div className="border-b border-border-subtle px-5 py-3.5">
          <p className="text-[13px] leading-[18px] font-semibold">
            {tabel.judul}
          </p>
        </div>
      ) : null}

      <div className="max-h-[75vh] overflow-auto overscroll-x-contain">
        <table className="w-full min-w-[1600px] border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              {KOLOM_BLOK.map((k) => (
                <th key={k} className={cn(th, LEBAR[k])}>
                  {JUDUL_KOLOM[k]}
                </th>
              ))}
              <th className={cn(th, LEBAR.kode)}>No / Kode</th>
              <th className={cn(th, LEBAR.rencana)}>Operational Plan</th>
              <th className={cn(th, LEBAR.jenis)}>Jenis</th>
              <th className={cn(th, LEBAR.siapa)}>Siapa / PIC</th>
              <th className={cn(th, LEBAR.kapan)}>Kapan / Deadline</th>
              <th className={cn(th, LEBAR.status)}>Status</th>
            </tr>
          </thead>
          <tbody>
            {tabel.baris.map((b, i) => {
              const status = statusBaris(b.tonggak, hariIni);
              const td = "border-b border-border-subtle px-3 py-2.5 align-top";
              return (
                <tr key={b.rencanaId} className="bg-card">
                  {KOLOM_BLOK.map((k) =>
                    rentang[i][k] > 0 ? (
                      <SelBlok
                        key={k}
                        blok={b.blok[k]}
                        kolom={k}
                        rentang={rentang[i][k]}
                      />
                    ) : null,
                  )}
                  <td className={td}>
                    <span className="tabular text-[11px] leading-[14px] font-bold">
                      {b.kode}
                    </span>
                  </td>
                  <td className={td}>
                    <p className="text-[12px] leading-[17px] whitespace-pre-line">
                      {b.judul}
                    </p>
                  </td>
                  <td className={td}>
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-bold tracking-wide uppercase",
                        GAYA_JENIS[b.jenis],
                      )}
                    >
                      {b.jenis}
                    </span>
                  </td>
                  <td className={cn(td, "text-[12px] leading-[17px]")}>
                    {b.picTeks}
                  </td>
                  <td className={cn(td, "text-[12px] leading-[17px]")}>
                    {b.jadwalTeks}
                  </td>
                  <td className={td}>
                    {status ? (
                      <Link
                        href="/grd/rencana"
                        className="tekan-halus inline-flex flex-col items-start gap-0.5"
                        title="Ubah status di Rencana operasional"
                      >
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                            GAYA_STATUS[status.status],
                          )}
                        >
                          {LABEL_STATUS_BARIS[status.status]}
                        </span>
                        {status.total > 1 ? (
                          <span className="tabular text-[10px] leading-[14px] text-muted-foreground">
                            {status.selesai}/{status.total} selesai
                          </span>
                        ) : null}
                      </Link>
                    ) : (
                      <span
                        className="text-[12px] leading-[17px] text-muted-foreground"
                        title="Pekerjaan harian dicek di DRM; belum ada status yang dicatat"
                      >
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tabel.catatan ? (
        <p className="border-t border-border-subtle px-5 py-3 text-[11px] leading-[16px] text-muted-foreground">
          {tabel.catatan}
        </p>
      ) : null}
    </Card>
  );
}
