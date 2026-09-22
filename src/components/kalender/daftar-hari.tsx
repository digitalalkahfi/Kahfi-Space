"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, TriangleAlert } from "lucide-react";
import { DetailAgenda } from "@/components/kalender/detail-agenda";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bulanPanjang, tanggalPanjang } from "@/lib/format";
import {
  GAYA_JENIS_AGENDA,
  geserBulan,
  idBentrok,
  LABEL_JENIS_AGENDA,
  perTanggal,
  type EntriKalender,
} from "@/lib/kalender";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

/**
 * Kalender sebagai daftar hari — bentuk utama di ponsel.
 *
 * Hanya hari yang berisi agenda yang ditampilkan: menggulir tiga puluh
 * kotak kosong untuk menemukan dua rapat bukan cara orang memakai
 * kalender di HP.
 */
export function DaftarHari({
  bulan,
  entri,
  hariIni,
  bolehUbah,
  pilihan,
  unitTerkunci,
}: {
  bulan: string;
  entri: EntriKalender[];
  hariIni: string;
  bolehUbah: boolean;
  pilihan: PilihanOrganisasi | null;
  unitTerkunci: KodeUnit | null;
}) {
  // Jadwal yang saling terlihat baru menolong kalau bentroknya ikut
  // kelihatan; dihitung sekali untuk seluruh bulan.
  const bentrokan = idBentrok(entri);
  const [terpilih, setTerpilih] = useState<EntriKalender | null>(null);
  const peta = perTanggal(entri);
  const tanggal = Object.keys(peta).sort();

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
            <CalendarDays className="size-4 text-muted-foreground" />
            {bulanPanjang(bulan)}
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {entri.length} agenda &amp; tenggat pada {tanggal.length} hari
          </p>
        </div>

        <div className="flex gap-1.5 lg:hidden">
          <Link
            href={`/kalender?bulan=${geserBulan(bulan, -1)}`}
            aria-label="Bulan sebelumnya"
            className="tekan-halus sentuh-nyaman rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold"
          >
            ←
          </Link>
          <Link
            href={`/kalender?bulan=${geserBulan(bulan, 1)}`}
            aria-label="Bulan berikutnya"
            className="tekan-halus sentuh-nyaman rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold"
          >
            →
          </Link>
        </div>
      </div>

      {tanggal.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Tidak ada agenda maupun tenggat pada bulan ini.
        </p>
      ) : (
        <ul className="space-y-3 px-5">
          {tanggal.map((t) => (
            <li key={t}>
              <p
                className={cn(
                  "text-[11px] leading-[14px] font-semibold tracking-[0.06em] uppercase",
                  t === hariIni ? "text-primary" : "text-muted-foreground",
                )}
              >
                {tanggalPanjang(t)}
                {t === hariIni ? " · hari ini" : ""}
              </p>

              <ul className="mt-1.5 space-y-1.5">
                {peta[t].map((e) => {
                  const gaya = GAYA_JENIS_AGENDA[e.jenis];
                  const isi = (
                    <>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
                            gaya.kelas,
                          )}
                        >
                          <span
                            className={cn("size-1.5 rounded-full", gaya.titik)}
                          />
                          {LABEL_JENIS_AGENDA[e.jenis]}
                        </span>
                        {e.unitNama ? (
                          <span className="text-[10px] leading-[14px] text-muted-foreground">
                            {e.unitNama}
                          </span>
                        ) : null}
                        {bentrokan.has(e.id) ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-warn-fill px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-warn-text"
                            title="Jamnya bertabrakan dengan agenda lain"
                          >
                            <TriangleAlert className="size-3" />
                            Bentrok
                          </span>
                        ) : null}
                      </span>

                      <span className="mt-1 block text-[13px] leading-[18px] font-semibold text-pretty">
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
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3" />
                            {e.lokasi}
                          </span>
                        ) : null}
                      </span>

                      {e.keterangan ? (
                        <span className="mt-0.5 block text-[11px] leading-[14px] text-pretty text-muted-foreground">
                          {e.keterangan}
                        </span>
                      ) : null}
                    </>
                  );

                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setTerpilih(e)}
                        className="baris-interaktif block w-full rounded-2xl bg-muted/50 p-3 text-left"
                      >
                        {isi}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <DetailAgenda
        entri={terpilih}
        buka={terpilih !== null}
        onBuka={(b) => {
          if (!b) setTerpilih(null);
        }}
        bolehUbah={bolehUbah}
        pilihan={pilihan}
        unitTerkunci={unitTerkunci}
      />
    </Card>
  );
}
