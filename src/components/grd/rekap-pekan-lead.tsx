import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen } from "@/lib/format";
import type { LeadDetail } from "@/lib/data/grd";

const ANGKA = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/** Tujuh tanggal pekan berjalan, mulai Senin. */
function tanggalPekan(mulai: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${mulai}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Rekap pekan: satu baris per lead measure, satu kolom per hari.
 * Bentuk ini memperlihatkan pola — hari mana yang selalu kosong.
 */
export function RekapPekanLead({
  daftar,
  awalPekan,
  hariIni,
}: {
  daftar: LeadDetail[];
  awalPekan: string;
  hariIni: string;
}) {
  const hari = tanggalPekan(awalPekan);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">Rekap pekan ini</h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Realisasi harian tiap langkah kunci
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <CalendarDays className="size-4" />
        </span>
      </div>

      <div className="overflow-x-auto px-5">
        <table className="w-full min-w-[34rem] border-collapse">
          <caption className="sr-only">
            Realisasi harian lead measure pekan berjalan
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="pb-2 text-left text-[11px] leading-[14px] font-semibold text-muted-foreground"
              >
                Langkah kunci
              </th>
              {hari.map((t, i) => (
                <th
                  key={t}
                  scope="col"
                  className={cn(
                    "pb-2 text-center text-[11px] leading-[14px] font-semibold",
                    t === hariIni ? "text-info-text" : "text-muted-foreground",
                  )}
                >
                  {HARI[i]}
                </th>
              ))}
              <th
                scope="col"
                className="pb-2 text-right text-[11px] leading-[14px] font-semibold text-muted-foreground"
              >
                Pekan
              </th>
            </tr>
          </thead>
          <tbody>
            {daftar.map((m) => {
              const peta = new Map(m.entri.map((e) => [e.tanggal, e.nilai]));
              const kuat = m.rasio >= 90;
              return (
                <tr key={m.id} className="border-t border-border-subtle">
                  <th
                    scope="row"
                    className="py-2.5 pr-3 text-left text-[13px] leading-[18px] font-medium"
                  >
                    {m.judul}
                    <span className="block text-[11px] leading-[14px] font-normal text-muted-foreground">
                      target {ANGKA.format(m.target)} {m.satuan}
                    </span>
                  </th>

                  {hari.map((t) => {
                    const nilai = peta.get(t);
                    const lewat = t <= hariIni;
                    return (
                      <td
                        key={t}
                        className={cn(
                          "tabular px-1 py-2.5 text-center text-[13px] leading-[18px]",
                          nilai === undefined && lewat
                            ? "text-danger-text"
                            : "text-foreground",
                        )}
                      >
                        {nilai !== undefined
                          ? ANGKA.format(nilai)
                          : lewat
                            ? "—"
                            : ""}
                      </td>
                    );
                  })}

                  <td
                    className={cn(
                      "tabular py-2.5 pl-3 text-right text-[13px] leading-[18px] font-bold",
                      kuat ? "text-ok-text" : "text-warn-text",
                    )}
                  >
                    {persen(m.rasio)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border-subtle px-5 pt-3 text-[11px] leading-[14px] text-muted-foreground">
        Tanda “—” berarti hari itu terlewat tanpa entri.
      </p>
    </Card>
  );
}
