"use client";

import Link from "next/link";
import { Layers } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas } from "@/lib/format";
import {
  LABEL_DIMENSI,
  bekalKembali,
  saringanDrill,
  type BarisDrill,
  type DimensiDrill,
} from "@/lib/drill-down";
import { KeadaanKosong } from "@/components/shared/keadaan";

const DIMENSI: DimensiDrill[] = ["divisi", "akun", "jenis", "periode"];

/**
 * Drill-down: angka periode ini dibedah per divisi, akun affiliate,
 * jenis pengeluaran, atau periode.
 *
 * Pilihannya disimpan di URL supaya "kenapa MCN turun" bisa dikirim ke
 * orang lain sebagai tautan, bukan sebagai instruksi klik.
 */
export function PanelDrillDown({
  dimensi,
  baris,
}: {
  dimensi: DimensiDrill;
  baris: BarisDrill[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const pindah = (ke: DimensiDrill) => {
    const baru = new URLSearchParams(params.toString());
    if (ke === "divisi") baru.delete("drill");
    else baru.set("drill", ke);
    const query = baru.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const puncak = Math.max(1, ...baris.map((b) => Math.abs(b.net)));

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Drill-down</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Angka gabungan menjawab &quot;berapa&quot;; bedahannya menjawab
          &quot;dari mana&quot; — dan itulah yang menentukan tindakan
          berikutnya.
        </p>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-6 pb-0.5">
        {DIMENSI.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => pindah(d)}
            aria-pressed={d === dimensi}
            className={cn(
              "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
              d === dimensi
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {LABEL_DIMENSI[d]}
          </button>
        ))}
      </div>

      {baris.length === 0 ? (
        <KeadaanKosong
          sisip
          className="px-5"
          ikon={<Layers className="size-4" />}
          judul={
            dimensi === "akun"
              ? "Tidak ada transaksi pada akun affiliate"
              : "Belum ada transaksi yang bisa dibedah"
          }
          pesan="Hanya transaksi berstatus dibayar yang masuk pembedahan; yang masih menunggu belum dihitung."
        />
      ) : (
        <ul className="space-y-2 px-5">
          {baris.map((b) => {
            // Tiap baris menuju daftar transaksinya sendiri, membawa
            // saringan dasbor supaya tombol kembali memulihkan keadaan
            // yang sama — bukan melempar orang ke dasbor kosong.
            const saringan = new URLSearchParams(saringanDrill(b, dimensi));
            const bekal = bekalKembali(new URLSearchParams(params.toString()));
            if (bekal) saringan.set("kembali", bekal);

            return (
              <li key={b.kunci} className="rounded-2xl bg-muted/50 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <Link
                    href={`/keuangan/transaksi?${saringan.toString()}`}
                    className="text-[13px] leading-[18px] font-semibold text-pretty hover:underline"
                  >
                    {b.label}
                  </Link>
                  <span
                    className={cn(
                      "tabular text-[13px] leading-[18px] font-semibold",
                      b.net < 0 ? "text-danger-text" : "text-ok-text",
                    )}
                  >
                    {b.net < 0 ? "−" : "+"}
                    {rupiahRingkas(Math.abs(b.net))}
                  </span>
                </div>

                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border-subtle">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      b.net < 0 ? "bg-danger" : "bg-secondary",
                    )}
                    style={{ width: `${(Math.abs(b.net) / puncak) * 100}%` }}
                  />
                </div>

                <p className="tabular mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-[14px] text-muted-foreground">
                  {b.pendapatan > 0 ? (
                    <span>masuk {rupiahRingkas(b.pendapatan)}</span>
                  ) : null}
                  {b.biaya > 0 ? (
                    <span>keluar {rupiahRingkas(b.biaya)}</span>
                  ) : null}
                  <span>{b.jumlahTransaksi} transaksi</span>
                  <span>{b.porsi}% dari total</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
        Bedah per creator belum ada di sini: transaksi creator share baru
        mencatat unitnya, belum nama kreatornya. Sampel produk sudah mencatat
        kreator, dan itulah tautan yang akan dipakai nanti.
      </p>
    </Card>
  );
}
