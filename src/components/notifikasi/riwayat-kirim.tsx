import { CheckCheck, Clock, MessageCircle, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { jamWib, tanggalRelatif } from "@/lib/format";
import {
  GAYA_STATUS_KIRIM,
  LABEL_STATUS_KIRIM,
  MAKS_PERCOBAAN,
  bisaCobaLagi,
  samarkanNomor,
  type Pengiriman,
  type StatusKirim,
} from "@/lib/kirim-wa";

const IKON: Record<StatusKirim, typeof MessageCircle> = {
  antre: Clock,
  terkirim: CheckCheck,
  gagal: TriangleAlert,
};

/**
 * Riwayat pengiriman WhatsApp.
 *
 * Yang ditampilkan adalah usahanya, bukan pesannya: ke nomor mana,
 * berhasil atau tidak, dan kenapa gagal. Kalimat galat dari gateway
 * ditulis apa adanya — ia satu-satunya petunjuk yang punya pemiliknya
 * saat pesan tidak sampai, dan menyembunyikannya di balik "terjadi
 * kesalahan" berarti tidak ada yang bisa ia lakukan.
 */
export function RiwayatKirim({
  daftar,
  hariIni,
}: {
  daftar: Pengiriman[];
  hariIni: string;
}) {
  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <ul className="-mx-2 space-y-1 px-5">
        {daftar.map((p) => {
          const Ikon = IKON[p.status];
          return (
            <li
              key={p.id}
              className="space-y-1 rounded-2xl p-3 hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 text-[13px] leading-[18px] font-semibold text-pretty">
                  {p.judul}
                </p>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
                    GAYA_STATUS_KIRIM[p.status],
                  )}
                >
                  <Ikon className="size-3" />
                  {LABEL_STATUS_KIRIM[p.status]}
                </span>
              </div>

              <p className="flex flex-wrap items-center gap-x-2 text-[11px] leading-[14px] text-muted-foreground">
                <span className="tabular">{samarkanNomor(p.tujuan)}</span>
                <span aria-hidden>·</span>
                <span>
                  {p.status === "terkirim" && p.dikirimPada
                    ? `Terkirim ${tanggalRelatif(p.dikirimPada, hariIni)} ${jamWib(p.dikirimPada)}`
                    : `Diantrekan ${tanggalRelatif(p.dibuatPada, hariIni)} ${jamWib(p.dibuatPada)}`}
                </span>
                {p.percobaan > 0 ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      percobaan ke-{p.percobaan} dari {MAKS_PERCOBAAN}
                    </span>
                  </>
                ) : null}
              </p>

              {p.galat ? (
                <p className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-warn-text">
                  {p.galat}
                  {bisaCobaLagi(p)
                    ? " Sistem akan mencobanya lagi."
                    : " Tidak akan dicoba lagi — notifikasinya tetap ada di lonceng."}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
