import Link from "next/link";
import { ChevronRight, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TrenTigaHariAkun } from "@/components/beranda/tren-tiga-hari";
import {
  GrafikBatangTarget,
  GrafikBatangUnggahan,
} from "@/components/shared/grafik-dasar";
import { cn } from "@/lib/utils";
import { bilangan, persen, rupiahPenuh, rupiahRingkas } from "@/lib/format";
import {
  GAYA_CAPAIAN,
  rasioCapaianAngka,
  totalHarian,
  warnaCapaian,
  type CapaianPribadi,
} from "@/lib/capaian";

/**
 * Capaian pribadi: akumulasi 28 hari terakhir terhadap target GRD, plus
 * diagram batang harian.
 *
 * Isinya mengikuti departemen pelapor — Affiliator melihat komisi, jumlah
 * upload, dan CO sampel; MCN & TAP cukup GMV. Yang tidak punya sasaran
 * laporan sama sekali tidak melihat kartu ini (lihat Beranda).
 */
export function KartuCapaianPribadi({ capaian }: { capaian: CapaianPribadi }) {
  const total = totalHarian(capaian.harian);
  const rasio = total.target > 0 ? (total.realisasi / total.target) * 100 : 0;
  const warna = warnaCapaian(rasio, total.target > 0);
  const totalUnggahan = capaian.unggahan.reduce(
    (a, h) => a + (h.unggahan ?? 0),
    0,
  );

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
            <Target className="size-4 text-muted-foreground" />
            Capaian saya
          </h2>
          <p className="truncate text-[13px] leading-[18px] text-muted-foreground">
            {capaian.lingkup} · 28 hari terakhir
          </p>
        </div>
        {warna ? (
          <span
            className={cn(
              "tabular shrink-0 rounded-full px-3 py-1 text-[13px] leading-[18px] font-bold",
              GAYA_CAPAIAN[warna].pil,
            )}
          >
            {persen(rasio)}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-[11px] leading-[14px] font-semibold text-muted-foreground">
            Target belum ada
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 px-5 sm:grid-cols-4">
        {capaian.angka.map((a) => {
          const r = rasioCapaianAngka(a);
          const w = warnaCapaian(r ?? 0, r !== null);
          return (
            <div key={a.kunci} className="min-w-0">
              <dt className="truncate text-[11px] leading-[14px] text-muted-foreground">
                {a.label}
              </dt>
              <dd className="tabular truncate text-base leading-6 font-bold tracking-tight">
                {a.satuan === "rupiah"
                  ? rupiahRingkas(a.realisasi)
                  : bilangan(a.realisasi)}
              </dd>
              <dd
                className={cn(
                  "tabular truncate text-[11px] leading-[14px]",
                  w ? GAYA_CAPAIAN[w].teks : "text-muted-foreground",
                )}
              >
                {a.target === null
                  ? "tanpa target"
                  : `${persen(r ?? 0)} dari ${
                      a.satuan === "rupiah"
                        ? rupiahRingkas(a.target)
                        : bilangan(a.target)
                    }`}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="px-5">
        <GrafikBatangTarget
          judul="GMV harian vs target"
          keterangan={`${rupiahPenuh(total.realisasi)} terkumpul dari target ${rupiahPenuh(total.target)} pada rentang ini.`}
          hari={capaian.harian}
        />
      </div>

      {capaian.unggahan.length > 0 ? (
        <div className="px-5">
          <GrafikBatangUnggahan
            judul="Unggahan harian"
            keterangan={
              capaian.minimumHarian === null
                ? `${bilangan(totalUnggahan)} unggahan pada rentang ini.`
                : `${bilangan(totalUnggahan)} unggahan pada rentang ini. Garis putus-putus adalah batas minimum level akun yang Anda pegang.`
            }
            hari={capaian.unggahan}
            minimum={capaian.minimumHarian}
          />
        </div>
      ) : null}

      {capaian.tren.length > 0 ? (
        <div className="px-5">
          <TrenTigaHariAkun tren={capaian.tren} />
        </div>
      ) : null}

      <div className="px-5">
        <Link
          href="/laporan-harian/riwayat"
          className="sentuh-nyaman inline-flex items-center gap-1 text-[13px] leading-[18px] font-semibold text-secondary hover:underline"
        >
          Lihat riwayat laporan
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}
