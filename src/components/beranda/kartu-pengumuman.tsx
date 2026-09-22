import Link from "next/link";
import { ArrowRight, ChevronRight, Megaphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { tanggalRelatif } from "@/lib/format";
import type { Pengumuman } from "@/lib/types";

/**
 * Pengumuman manajemen di beranda: satu yang disematkan tampil utuh,
 * sisanya jadi daftar ringkas. Keduanya menuju halaman detail.
 */
export function KartuPengumuman({
  pengumuman,
  hariIni,
}: {
  pengumuman: Pengumuman[];
  /** Tanggal acuan untuk label "Hari ini" / "Kemarin". */
  hariIni: string;
}) {
  if (pengumuman.length === 0) return null;

  const utama = pengumuman.find((p) => p.disematkan) ?? pengumuman[0];
  const lainnya = pengumuman.filter((p) => p.id !== utama.id);

  return (
    <div className="space-y-3">
      <Card className="kartu-interaktif rounded-3xl bg-primary text-primary-foreground shadow-overlay ring-0">
        <div className="space-y-3 px-5">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1 text-[11px] leading-[14px] font-semibold tracking-[0.06em] uppercase">
              Info Operasional
            </span>
            <Megaphone className="size-4 shrink-0 opacity-70" />
          </div>

          <div>
            <h3 className="text-base leading-6 font-semibold">{utama.judul}</h3>
            <p className="mt-1.5 text-[13px] leading-[18px] text-primary-foreground/75">
              {utama.ringkasan}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[11px] leading-[14px] text-primary-foreground/60">
              {utama.jabatanPembuat} ·{" "}
              {tanggalRelatif(utama.publishedAt, hariIni)}
            </p>
            <Link
              href={`/pengumuman/${utama.id}`}
              className="tekan-halus sentuh-nyaman inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-[11px] leading-[14px] font-semibold hover:bg-primary-foreground/20"
            >
              Baca selengkapnya
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </Card>

      {lainnya.length > 0 ? (
        <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
          <div className="flex items-center justify-between gap-3 px-5">
            <h3 className="text-[13px] leading-[18px] font-semibold">
              Pengumuman lain
            </h3>
            <Link
              href="/pengumuman"
              className="sentuh-nyaman shrink-0 text-[11px] leading-[14px] font-semibold text-secondary hover:underline"
            >
              Lihat semua
            </Link>
          </div>

          <ul className="space-y-0.5 px-5">
            {lainnya.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/pengumuman/${p.id}`}
                  className="baris-interaktif flex items-center gap-2 rounded-xl px-1 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] leading-[18px] font-medium">
                      {p.judul}
                    </span>
                    <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                      {tanggalRelatif(p.publishedAt, hariIni)} ·{" "}
                      {p.targetUnit ?? p.targetPeran}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
