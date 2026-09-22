import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bulanPanjang } from "@/lib/format";
import {
  dalamBulan,
  GAYA_JENIS_AGENDA,
  geserBulan,
  LABEL_JENIS_AGENDA,
  perTanggal,
  petakBulan,
  type EntriKalender,
} from "@/lib/kalender";

const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/**
 * Petak kalender satu bulan.
 *
 * Di layar sempit, petak 7 kolom membuat tiap sel terlalu kecil untuk
 * dibaca. Karena itu petaknya hanya muncul pada layar lebar; di ponsel
 * kalender disajikan sebagai daftar hari berisi agenda — bentuk yang
 * memang lebih berguna saat yang dicari adalah "hari ini ada apa".
 */
export function PetakKalender({
  bulan,
  entri,
  hariIni,
}: {
  bulan: string;
  entri: EntriKalender[];
  hariIni: string;
}) {
  const petak = petakBulan(bulan);
  const peta = perTanggal(entri);

  return (
    <Card className="kartu-interaktif hidden rounded-3xl shadow-card ring-border-subtle lg:block">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5">
        <h2 className="text-base leading-6 font-semibold">
          {bulanPanjang(bulan)}
        </h2>

        <div className="flex gap-1.5">
          <Link
            href={`/kalender?bulan=${geserBulan(bulan, -1)}`}
            className="tekan-halus sentuh-nyaman rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold"
          >
            ← {bulanPanjang(geserBulan(bulan, -1)).split(" ")[0]}
          </Link>
          <Link
            href={`/kalender?bulan=${geserBulan(bulan, 1)}`}
            className="tekan-halus sentuh-nyaman rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold"
          >
            {bulanPanjang(geserBulan(bulan, 1)).split(" ")[0]} →
          </Link>
        </div>
      </div>

      <div className="px-5">
        <div className="grid grid-cols-7 gap-1">
          {HARI.map((h) => (
            <div
              key={h}
              className="pb-1 text-center text-[10px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
            >
              {h}
            </div>
          ))}

          {petak.flat().map((tanggal) => {
            const isi = peta[tanggal] ?? [];
            const luar = !dalamBulan(tanggal, bulan);

            return (
              <div
                key={tanggal}
                className={cn(
                  "min-h-24 rounded-xl p-1.5",
                  tanggal === hariIni
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : luar
                      ? "bg-muted/30"
                      : "bg-muted/50",
                )}
              >
                <p
                  className={cn(
                    "tabular text-[11px] leading-[14px] font-semibold",
                    luar ? "text-muted-foreground/50" : "",
                    tanggal === hariIni && "text-primary",
                  )}
                >
                  {Number(tanggal.slice(8, 10))}
                </p>

                <ul className="mt-1 space-y-0.5">
                  {isi.slice(0, 3).map((e) => {
                    const gaya = GAYA_JENIS_AGENDA[e.jenis];
                    return (
                      <li
                        key={e.id}
                        title={`${e.judul}${e.jamMulai ? ` · ${e.jamMulai}` : ""}`}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[10px] leading-[14px] font-medium",
                          gaya.kelas,
                        )}
                      >
                        {e.jamMulai ? `${e.jamMulai} ` : ""}
                        {e.judul}
                      </li>
                    );
                  })}
                  {isi.length > 3 ? (
                    <li className="px-1 text-[10px] leading-[14px] text-muted-foreground">
                      +{isi.length - 3} lagi
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Keterangan warna; tanpa ini petaknya hanya tebak-tebakan. */}
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {(["rapat", "pelatihan", "libur", "tenggat", "lainnya"] as const).map(
            (j) => (
              <li
                key={j}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
                  GAYA_JENIS_AGENDA[j].kelas,
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    GAYA_JENIS_AGENDA[j].titik,
                  )}
                />
                {LABEL_JENIS_AGENDA[j]}
              </li>
            ),
          )}
        </ul>
      </div>
    </Card>
  );
}
