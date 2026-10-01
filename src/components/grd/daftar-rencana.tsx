import { CalendarClock, ClipboardList, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PilihStatusTonggak } from "@/components/grd/pilih-status-tonggak";
import { cn } from "@/lib/utils";
import { tanggalKalenderPendek } from "@/lib/format";
import {
  LABEL_JENIS,
  kelompokRencana,
  ringkasTonggak,
  type Rencana,
} from "@/lib/rencana";

const GAYA_JENIS: Record<Rencana["jenis"], string> = {
  sekali: "bg-info-fill text-info-text",
  pekanan: "bg-accentmuted-fill text-accentmuted-text",
  harian: "bg-muted text-muted-foreground",
};

/** Label chip: tanggal untuk tonggak bertanggal, judul tahap bila beberapa. */
function labelTonggak(r: Rencana, i: number, hariIni: string): string {
  const t = r.tonggak[i];
  if (r.tonggak.length > 1 && r.jenis === "sekali") return t.judul;
  if (!t.tenggat) return t.judul;
  return tanggalKalenderPendek(t.tenggat, hariIni);
}

function BarisRencana({ r, hariIni }: { r: Rencana; hariIni: string }) {
  const ringkas = ringkasTonggak(r.tonggak, hariIni);
  return (
    <li className="space-y-2 px-5 py-3.5">
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
        <span className="tabular rounded-md bg-muted px-1.5 py-0.5 text-[11px] leading-[14px] font-bold">
          {r.kode}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
            GAYA_JENIS[r.jenis],
          )}
        >
          {LABEL_JENIS[r.jenis]}
        </span>
        {r.tonggak.length > 1 && ringkas.jatuh > 0 ? (
          <span className="tabular ml-auto text-[11px] leading-[14px] text-muted-foreground">
            tepat {ringkas.tepat}/{ringkas.jatuh}
          </span>
        ) : null}
      </div>
      <p className="text-[13px] leading-[18px] font-medium">{r.judul}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] leading-[14px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3" aria-hidden />
          {r.picTeks || r.picNama.join(", ") || "—"}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3" aria-hidden />
          {r.jadwalTeks || "—"}
        </span>
      </div>
      {r.tonggak.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {r.tonggak.map((t, i) => (
            <PilihStatusTonggak
              key={t.id}
              tonggak={t}
              hariIni={hariIni}
              bolehUbah={r.bolehCentang}
              label={labelTonggak(r, i, hariIni)}
            />
          ))}
        </div>
      ) : r.jenis === "harian" ? (
        <p className="text-[11px] leading-[14px] text-muted-foreground">
          Dicek harian di DRM; yang tercatat di laporan harian ikut mengalir ke
          KPI.
        </p>
      ) : (
        <p className="text-[11px] leading-[14px] text-muted-foreground">
          Tanpa jadwal tetap; dibahas di WRM.
        </p>
      )}
    </li>
  );
}

/**
 * Rencana operasional GRD dikelompokkan menurut goal yang dilayaninya,
 * dengan ringkasan tonggak tepat waktu per kelompok.
 */
export function DaftarRencana({
  daftar,
  hariIni,
}: {
  daftar: Rencana[];
  hariIni: string;
}) {
  if (daftar.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <ClipboardList className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-[13px] leading-[18px] font-semibold">
            Belum ada rencana operasional bulan ini
          </p>
          <p className="max-w-sm text-[13px] leading-[18px] text-muted-foreground">
            Rencana dan tonggak masuk lewat impor file GRD bulanan.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {kelompokRencana(daftar).map((k) => {
        const ringkas = ringkasTonggak(
          k.rencana.flatMap((r) => r.tonggak),
          hariIni,
        );
        return (
          <Card
            key={k.kunci}
            className="overflow-hidden rounded-3xl py-0 shadow-card ring-border-subtle"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle px-5 py-3.5">
              <h2 className="text-[15px] leading-5 font-semibold">{k.judul}</h2>
              {ringkas.jatuh > 0 ? (
                <span
                  className={cn(
                    "tabular rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-bold",
                    ringkas.persen !== null && ringkas.persen >= 100
                      ? "bg-ok-fill text-ok-text"
                      : "bg-warn-fill text-warn-text",
                  )}
                >
                  tepat waktu {ringkas.tepat}/{ringkas.jatuh}
                </span>
              ) : null}
            </div>
            <ul className="divide-y divide-border-subtle">
              {k.rencana.map((r) => (
                <BarisRencana key={r.id} r={r} hariIni={hariIni} />
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
