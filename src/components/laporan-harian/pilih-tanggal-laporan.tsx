import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BATAS_SUSULAN_HARI,
  labelHariLaporan,
  type HariTerlewat,
} from "@/lib/laporan";

/** Alamat halaman laporan untuk sebuah tanggal; persona demo ikut dibawa. */
export function tautanTanggalLaporan(
  tanggal: string,
  hariIni: string,
  persona?: string,
) {
  const q = new URLSearchParams();
  if (persona) q.set("persona", persona);
  if (tanggal !== hariIni) q.set("tanggal", tanggal);
  const teks = q.toString();
  return teks ? `/laporan-harian?${teks}` : "/laporan-harian";
}

/**
 * Pilihan tanggal laporan: hari ini, dan hari-hari dalam batas susulan
 * yang laporannya belum lengkap — mis. karena pelapornya sakit. Tidak
 * muncul bila tidak ada yang terlewat, jadi form hari biasa tetap
 * sesederhana sebelumnya.
 */
export function PilihTanggalLaporan({
  hariIni,
  tanggal,
  terlewat,
  persona,
}: {
  hariIni: string;
  /** Tanggal yang sedang dilapor. */
  tanggal: string;
  terlewat: readonly HariTerlewat[];
  persona?: string;
}) {
  if (terlewat.length === 0 && tanggal === hariIni) return null;

  const pilihan = [
    { tanggal: hariIni, belum: 0 },
    ...terlewat.map((h) => ({ tanggal: h.tanggal, belum: h.belum.length })),
  ];
  // Tanggal susulan yang baru saja lengkap tetap tampil, supaya jelas
  // sedang berada di tanggal mana.
  if (!pilihan.some((p) => p.tanggal === tanggal)) {
    pilihan.push({ tanggal, belum: 0 });
  }
  pilihan.sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  return (
    <div className="space-y-1.5 text-left">
      <p className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold">
        <CalendarClock className="size-3.5 text-muted-foreground" />
        Tanggal laporan
      </p>
      <div className="flex flex-wrap gap-1.5">
        {pilihan.map((p) => {
          const aktif = p.tanggal === tanggal;
          return (
            <Link
              key={p.tanggal}
              href={tautanTanggalLaporan(p.tanggal, hariIni, persona)}
              scroll={false}
              aria-current={aktif ? "date" : undefined}
              className={cn(
                "tekan-halus inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] leading-[14px] font-semibold",
                aktif
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {labelHariLaporan(p.tanggal, hariIni)}
              {p.belum > 0 ? (
                <span
                  className={cn(
                    "tabular rounded-full px-1.5 py-0.5 text-[10px] leading-[13px]",
                    aktif
                      ? "bg-primary-foreground/20"
                      : "bg-warn-fill text-warn-text",
                  )}
                >
                  {p.belum} belum
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
      <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
        {terlewat.length > 0
          ? `Ada laporan yang terlewat. Pilih tanggalnya untuk melapor susulan, paling lama ${BATAS_SUSULAN_HARI} hari ke belakang.`
          : "Tidak ada lagi laporan yang terlewat."}
      </p>
    </div>
  );
}
