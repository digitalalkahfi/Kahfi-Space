import { Boxes, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas } from "@/lib/format";
import { ringkasAset, type Aset } from "@/lib/aset";

/**
 * Angka yang menjawab "nilai barang perusahaan tinggal berapa, dan berapa
 * yang sudah hangus". Tanpa izin melihat angka perusahaan, kartu ini
 * tetap berguna: jumlah barang dan yang perlu ditindak bukan rahasia.
 */
export function RingkasanAset({
  daftar,
  sampai,
  bolehLihatNilai,
}: {
  daftar: Aset[];
  /** Tanggal acuan perhitungan penyusutan. */
  sampai: string;
  bolehLihatNilai: boolean;
}) {
  const r = ringkasAset(daftar, sampai);
  const terpakai =
    r.nilaiPerolehan > 0
      ? Math.min(100, (r.akumulasiPenyusutan / r.nilaiPerolehan) * 100)
      : 0;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <Boxes className="size-4 text-muted-foreground" />
          Aset & inventaris
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {r.dimiliki} aset masih dimiliki dari {r.total} yang pernah tercatat.
        </p>
      </div>

      {bolehLihatNilai ? (
        <div className="tabular px-5">
          <div className="rounded-2xl bg-muted/50 p-3.5">
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              Nilai buku hari ini
            </p>
            <p className="text-[22px] leading-7 font-bold tracking-tight">
              {rupiahRingkas(r.nilaiBuku)}
            </p>
            <div
              className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border-subtle"
              role="img"
              aria-label={`${Math.round(terpakai)} persen nilai perolehan sudah disusutkan`}
            >
              <div
                className="h-full rounded-full bg-secondary transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{ width: `${terpakai}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
              Dari {rupiahRingkas(r.nilaiPerolehan)} perolehan,{" "}
              {rupiahRingkas(r.akumulasiPenyusutan)} sudah disusutkan ·{" "}
              {rupiahRingkas(r.susutBulanIni)} per bulan berjalan.
            </p>
          </div>
        </div>
      ) : null}

      <dl className="tabular grid grid-cols-2 gap-2 px-5">
        <div
          className={cn(
            "rounded-2xl p-3",
            r.perluPerhatian > 0 ? "bg-warn-fill" : "bg-muted/50",
          )}
        >
          <dt
            className={cn(
              "flex items-center gap-1.5 text-[11px] leading-[14px]",
              r.perluPerhatian > 0 ? "text-warn-text" : "text-muted-foreground",
            )}
          >
            {r.perluPerhatian > 0 ? <TriangleAlert className="size-3" /> : null}
            Perlu ditindak
          </dt>
          <dd
            className={cn(
              "text-lg leading-6 font-bold tracking-tight",
              r.perluPerhatian > 0 && "text-warn-text",
            )}
          >
            {r.perluPerhatian}
          </dd>
          <dd
            className={cn(
              "text-[11px] leading-[14px] text-pretty",
              r.perluPerhatian > 0 ? "text-warn-text" : "text-muted-foreground",
            )}
          >
            {bolehLihatNilai && r.nilaiHilang > 0
              ? `${rupiahRingkas(r.nilaiHilang)} hangus karena hilang`
              : "diperbaiki atau hilang"}
          </dd>
        </div>

        <div
          className={cn(
            "rounded-2xl p-3",
            r.tanpaPemegang > 0 ? "bg-danger-fill" : "bg-muted/50",
          )}
        >
          <dt
            className={cn(
              "text-[11px] leading-[14px]",
              r.tanpaPemegang > 0
                ? "text-danger-text"
                : "text-muted-foreground",
            )}
          >
            Dipakai tanpa pemegang
          </dt>
          <dd
            className={cn(
              "text-lg leading-6 font-bold tracking-tight",
              r.tanpaPemegang > 0 && "text-danger-text",
            )}
          >
            {r.tanpaPemegang}
          </dd>
          <dd
            className={cn(
              "text-[11px] leading-[14px] text-pretty",
              r.tanpaPemegang > 0
                ? "text-danger-text"
                : "text-muted-foreground",
            )}
          >
            {r.tanpaPemegang > 0
              ? "tidak ada yang bertanggung jawab"
              : "semua ada penanggung jawabnya"}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
