import Link from "next/link";
import { CalendarClock, Clock, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalPendek } from "@/lib/format";
import {
  GAYA_JENIS_AGENDA,
  LABEL_JENIS_AGENDA,
  type EntriKalender,
} from "@/lib/kalender";

/**
 * Acara terdekat di Beranda.
 *
 * Rapat yang terlewat biasanya bukan karena tidak dicatat, melainkan
 * karena kalendernya tidak pernah dibuka. Yang ditampilkan hanya beberapa
 * yang paling dekat — daftar panjang di Beranda hanya jadi hiasan.
 */
export function AgendaTerdekat({
  daftar,
  hariIni,
}: {
  daftar: EntriKalender[];
  hariIni: string;
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <CalendarClock className="size-4 text-muted-foreground" />
          Agenda terdekat
        </h2>
        <Link
          href="/kalender"
          className="tekan-halus sentuh-nyaman shrink-0 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-muted-foreground hover:text-foreground"
        >
          Kalender
        </Link>
      </div>

      {daftar.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Tidak ada agenda dalam waktu dekat.
        </p>
      ) : (
        <ul className="space-y-2 px-5">
          {daftar.map((e) => {
            const gaya = GAYA_JENIS_AGENDA[e.jenis];
            const isiBaris = (
              <>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
                      gaya.kelas,
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", gaya.titik)} />
                    {LABEL_JENIS_AGENDA[e.jenis]}
                  </span>
                  <span className="text-[10px] leading-[14px] text-muted-foreground">
                    {e.tanggal === hariIni
                      ? "Hari ini"
                      : tanggalPendek(e.tanggal)}
                  </span>
                </span>

                <span className="mt-1 block truncate text-[13px] leading-[18px] font-semibold">
                  {e.judul}
                </span>

                <span className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] leading-[14px] text-muted-foreground">
                  {e.jamMulai ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {e.jamMulai}
                      {e.jamSelesai ? `–${e.jamSelesai}` : ""}
                    </span>
                  ) : (
                    <span>Sepanjang hari</span>
                  )}
                  {e.lokasi ? (
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{e.lokasi}</span>
                    </span>
                  ) : null}
                </span>
              </>
            );

            // Agenda punya halamannya sendiri; entri tarikan menuju modul
            // asalnya.
            const tautan =
              e.sumber === "agenda" ? `/kalender/${e.id}` : e.tautan;

            return (
              <li key={e.id} className="rounded-2xl bg-muted/50 p-3">
                {tautan ? (
                  <Link href={tautan} className="baris-interaktif block">
                    {isiBaris}
                  </Link>
                ) : (
                  isiBaris
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
