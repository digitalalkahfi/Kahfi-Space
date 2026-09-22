import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas } from "@/lib/format";
import {
  judulAnggaran,
  selisihTerbesar,
  type BarisAnggaran,
} from "@/lib/budget";

/**
 * Anggaran vs realisasi berdampingan, diurutkan dari selisih rupiah
 * terbesar.
 *
 * Daftar per pos memakai persentase karena di sanalah statusnya
 * diputuskan; tampilan ini justru memakai rupiah. Persentase menyesatkan
 * saat pagunya kecil — pos Rp 2 juta yang jebol 200% menggeser perhatian
 * dari pos Rp 200 juta yang lewat 5%, padahal yang kedua memakan kas
 * sepuluh kali lipat lebih banyak.
 */
export function BandingRealisasi({ baris }: { baris: BarisAnggaran[] }) {
  const urut = selisihTerbesar(baris);
  if (urut.length === 0) return null;

  // Skala bersama: pagu dan realisasi terbesar menentukan lebar penuh,
  // supaya panjang batang antar pos bisa dibandingkan langsung.
  const acuan = Math.max(
    1,
    ...urut.map((s) => Math.max(s.baris.anggaran.jumlah, s.baris.realisasi)),
  );

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Realisasi vs anggaran
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Diurutkan dari selisih rupiah terbesar — bukan persentase, supaya pos
          kecil yang jebol tidak menutupi pos besar yang meleset.
        </p>
      </div>

      <ul className="space-y-3 px-5">
        {urut.map(({ baris: b, selisih }) => {
          const lewat = selisih > 0;
          return (
            <li key={b.anggaran.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-[13px] leading-[18px] font-semibold text-pretty">
                  {judulAnggaran(b.anggaran)}
                </span>
                <span
                  className={cn(
                    "tabular text-[13px] leading-[18px] font-semibold",
                    lewat ? "text-danger-text" : "text-ok-text",
                  )}
                >
                  {lewat ? "+" : "−"}
                  {rupiahRingkas(Math.abs(selisih))}
                </span>
              </div>

              {/* Dua batang bertumpuk: pagu sebagai latar, realisasi di
                  atasnya — lebih mudah dibaca daripada dua batang
                  terpisah yang harus dibandingkan dengan mata. */}
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[11px] leading-[14px] text-muted-foreground">
                    Anggaran
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-muted-foreground/40"
                      style={{
                        width: `${(b.anggaran.jumlah / acuan) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="tabular w-16 shrink-0 text-right text-[11px] leading-[14px] text-muted-foreground">
                    {rupiahRingkas(b.anggaran.jumlah)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[11px] leading-[14px] text-muted-foreground">
                    Realisasi
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        lewat ? "bg-danger" : "bg-secondary",
                      )}
                      style={{ width: `${(b.realisasi / acuan) * 100}%` }}
                    />
                  </span>
                  <span className="tabular w-16 shrink-0 text-right text-[11px] leading-[14px] font-semibold">
                    {rupiahRingkas(b.realisasi)}
                  </span>
                </div>
              </div>

              {b.tertahan > 0 ? (
                <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  Ditambah {rupiahRingkas(b.tertahan)} yang sudah disetujui
                  tetapi belum dibayar.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
