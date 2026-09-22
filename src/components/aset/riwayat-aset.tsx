import { History, MapPin, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalPendek } from "@/lib/format";
import {
  GAYA_STATUS_ASET,
  LABEL_STATUS_ASET,
  type KejadianAset,
} from "@/lib/aset";
import { KeadaanKosong } from "@/components/shared/keadaan";

/**
 * Riwayat pemegang sebuah aset.
 *
 * Yang ditampilkan bukan hanya keadaan barunya, tetapi siapa yang
 * memegangnya sejak kejadian itu — barang hilang hampir selalu ditelusuri
 * lewat pertanyaan "terakhir di tangan siapa", bukan "statusnya apa".
 */
export function RiwayatAset({ daftar }: { daftar: KejadianAset[] }) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <History className="size-4 text-muted-foreground" />
          Riwayat pemegang
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Tidak pernah disunting; koreksi dicatat sebagai kejadian baru.
        </p>
      </div>

      {daftar.length === 0 ? (
        <KeadaanKosong
          sisip
          className="px-5"
          ikon={<History className="size-4" />}
          judul="Belum ada catatan perpindahan"
          pesan="Aset ini belum pernah berpindah tangan sejak dicatat."
        />
      ) : (
        <ol className="space-y-2 px-5">
          {daftar.map((k) => {
            const gaya = GAYA_STATUS_ASET[k.ke];
            const pindahTangan = k.dari === k.ke;
            return (
              <li key={k.id} className="rounded-2xl bg-muted/50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                      gaya.kelas,
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", gaya.titik)} />
                    {LABEL_STATUS_ASET[k.ke]}
                  </span>
                  <span className="text-[11px] leading-[14px] text-muted-foreground">
                    {k.dari === null
                      ? "sejak diperoleh"
                      : pindahTangan
                        ? "pindah tangan"
                        : `dari ${LABEL_STATUS_ASET[k.dari].toLowerCase()}`}
                  </span>
                </div>

                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="size-3" />
                    {k.pemegangNama ?? "Tanpa pemegang"}
                  </span>
                  {k.lokasi ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" />
                      {k.lokasi}
                    </span>
                  ) : null}
                  <span>{tanggalPendek(k.pada)}</span>
                  {k.olehNama ? <span>dicatat {k.olehNama}</span> : null}
                </p>

                {k.catatan ? (
                  <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                    {k.catatan}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
