import Link from "next/link";
import { FileText, Info } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Dari mana angka di halaman ini berasal.
 *
 * Ditulis terang-terangan, bukan sebagai catatan kaki kecil, karena
 * salah paham di sini mahal: orang mudah mengira dasbor GMV adalah
 * cerminan langsung TikTok Shop atau Shopee, lalu menyalahkan
 * "sistemnya" ketika angkanya tidak cocok. Yang sebenarnya terjadi
 * hampir selalu: ada laporan yang belum masuk.
 */
export function CatatanSumber({
  hariTerlapor,
  hariDalamRentang,
  tanpaRincian = false,
}: {
  hariTerlapor: number;
  hariDalamRentang: number;
  /** Rentangnya terlalu panjang untuk menarik rincian per laporan. */
  tanpaRincian?: boolean;
}) {
  const bolong = Math.max(0, hariDalamRentang - hariTerlapor);

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-2 px-5">
        <h2 className="flex items-center gap-2 text-[13px] leading-[18px] font-semibold">
          <Info className="size-3.5 shrink-0 text-muted-foreground" />
          Dari mana angka ini
        </h2>

        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Seluruh angka di halaman ini berasal dari{" "}
          <span className="font-semibold text-foreground">
            laporan GMV harian yang diisi manual
          </span>{" "}
          oleh PIC akun dan unit — bukan tarikan otomatis dari TikTok Shop
          maupun Shopee. Tidak ada tabel ringkasan tersendiri: yang dibaca
          adalah laporan aslinya, jadi koreksi pada sebuah laporan langsung
          terlihat di sini.
        </p>

        {bolong > 0 ? (
          <p className="text-[13px] leading-[18px] text-pretty text-warn-text">
            {bolong} dari {hariDalamRentang} hari pada rentang ini belum punya
            laporan sama sekali. Hari itu tidak dihitung sebagai nol — ia memang
            tidak ada di grafik — jadi total di atas adalah total hari yang
            terlapor, bukan total rentangnya.
          </p>
        ) : (
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Semua {hariDalamRentang} hari pada rentang ini punya laporan.
          </p>
        )}

        {tanpaRincian ? (
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Rentang ini lebih panjang dari tiga bulan, jadi angkanya dijumlahkan
            langsung oleh basis data dan tabel rincian harian tidak ditampilkan.
            Persempit periodenya untuk menelusuri laporan per hari.
          </p>
        ) : null}

        <Link
          href="/laporan-harian"
          className="tekan-halus sentuh-nyaman inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-4 text-[11px] leading-[14px] font-semibold ring-1 ring-border-subtle"
        >
          <FileText className="size-3.5" />
          Buka Laporan Harian
        </Link>
      </div>
    </Card>
  );
}
