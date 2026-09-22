import { QrCode, ScanLine, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { jamWib, tanggalPendek } from "@/lib/format";
import { SaringScan } from "@/components/sampel/saring-scan";
import type { KodeAsing, PemindaianTerakhir } from "@/lib/data/sampel";
import type { SaringanScan } from "@/lib/saring-sampel";
import { KeadaanKosong } from "@/components/shared/keadaan";

/**
 * Riwayat pemindaian QR.
 *
 * Dipisahkan dari riwayat perpindahan karena keduanya menjawab hal yang
 * berbeda: perpindahan menjawab "barangnya di mana", pemindaian menjawab
 * "barangnya benar-benar dilihat orang, kapan" — termasuk kode yang tidak
 * dikenali sama sekali.
 */
export function RiwayatScan({
  daftar,
  asing,
  saringan,
  total,
}: {
  daftar: PemindaianTerakhir[];
  asing: KodeAsing[];
  saringan: SaringanScan;
  total: number;
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <ScanLine className="size-4 text-muted-foreground" />
          Pemindaian terakhir
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Setiap pemindaian tercatat, termasuk yang kodenya tidak dikenali.
        </p>
      </div>

      <SaringScan saringan={saringan} jumlah={daftar.length} total={total} />

      {asing.length > 0 ? (
        <div className="mx-5 rounded-2xl bg-warn-fill px-4 py-2.5">
          <p className="flex items-start gap-2 text-[13px] leading-[18px] text-warn-text">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span className="text-pretty">
              {asing.length} kode dipindai tapi tidak dikenali. Biasanya label
              tertukar atau stiker lama yang masih beredar.
            </span>
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {asing.map((k) => (
              <li
                key={k.kode}
                className="tabular rounded-full bg-card px-2.5 py-1 text-[11px] leading-[14px] font-semibold"
              >
                {k.kode} · {k.jumlah}×
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {daftar.length === 0 ? (
        <KeadaanKosong
          sisip
          className="px-5"
          ikon={<ScanLine className="size-4" />}
          judul={
            total === 0
              ? "Belum ada pemindaian yang tercatat"
              : "Tidak ada pemindaian yang cocok dengan saringan ini"
          }
          pesan={
            total === 0
              ? "Setiap kali kode sampel dipindai, barisnya muncul di sini beserta siapa yang memindai."
              : "Longgarkan saringan untuk melihat pemindaian lain."
          }
        />
      ) : (
        <ul className="space-y-2 px-5">
          {daftar.map((s) => (
            <li
              key={s.id}
              className={cn(
                "baris-interaktif flex items-start gap-3 rounded-2xl p-3.5",
                s.dikenali ? "bg-muted/50" : "bg-warn-fill/40",
              )}
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground">
                <QrCode className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] leading-[18px] font-semibold">
                  {s.sampelNama ?? s.kode}
                </p>
                <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
                  {s.dikenali ? s.kode : "Kode tidak dikenali"}
                  {s.olehNama ? ` · ${s.olehNama}` : ""}
                  {s.berlanjut ? " · berlanjut ke perpindahan" : ""}
                </p>
              </div>

              <span className="shrink-0 text-right text-[11px] leading-[14px] text-muted-foreground">
                {tanggalPendek(s.pada.slice(0, 10))}
                <span className="block">{jamWib(s.pada)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
