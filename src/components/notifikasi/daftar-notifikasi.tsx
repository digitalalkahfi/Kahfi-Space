import { Card } from "@/components/ui/card";
import { ItemNotifikasi } from "@/components/notifikasi/item-notifikasi";
import { kelompokkanNotifikasi, type Notifikasi } from "@/lib/notifikasi";

/**
 * Notifikasi dikelompokkan per rentang waktu.
 *
 * Bukan satu daftar panjang: yang dicari orang saat membuka lonceng
 * hampir selalu "apa yang terjadi sejak terakhir saya lihat", dan
 * pertanyaan itu dijawab oleh waktu, bukan oleh urutan nomor.
 */
export function DaftarNotifikasi({
  daftar,
  hariIni,
  waGagal,
}: {
  daftar: Notifikasi[];
  hariIni: string;
  /** Id notifikasi yang pesan WhatsApp-nya gagal terkirim. */
  waGagal: Set<string>;
}) {
  const kelompok = kelompokkanNotifikasi(daftar, hariIni);

  return (
    <div className="space-y-3">
      {kelompok.map((k) => (
        <Card
          key={k.kelompok}
          className="rounded-3xl shadow-card ring-border-subtle"
        >
          <div className="space-y-1 px-5">
            <h2 className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              {k.label}
            </h2>
            <ul className="-mx-3 space-y-0.5">
              {k.isi.map((n) => (
                <li key={n.id}>
                  <ItemNotifikasi
                    n={n}
                    hariIni={hariIni}
                    bisaTandai
                    waGagal={waGagal.has(n.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ))}
    </div>
  );
}
