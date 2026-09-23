import { CircleDollarSign, PlusCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahPenuh, rupiahRingkas, tanggalPendek } from "@/lib/format";
import { GAYA_STATUS_ALOKASI, LABEL_STATUS_ALOKASI } from "@/lib/budget";
import {
  judulPeristiwa,
  periodePanjang,
  type PeristiwaAnggaran,
  type RingkasPeriode,
} from "@/lib/riwayat-anggaran";

/**
 * Pagu berjalan per periode: pagu awal + tambahan yang sudah disetujui.
 *
 * Pengajuan yang masih menunggu ditulis terpisah, bukan dijumlahkan:
 * uang yang belum diputuskan siapa pun bukan pagu.
 */
export function RingkasanPeriode({ baris }: { baris: RingkasPeriode[] }) {
  if (baris.length === 0) return null;

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-1 px-5">
        <h2 className="text-base leading-6 font-semibold">Pagu berjalan</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Pagu awal tiap periode beserta tambahan yang sudah disetujui.
        </p>
      </div>

      <div className="overflow-x-auto px-5">
        <table className="w-full min-w-[30rem] border-collapse text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border-subtle text-left">
              {["Periode", "Pagu awal", "Tambahan", "Pagu berjalan"].map(
                (h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={cn(
                      "py-2 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase",
                      i === 0 ? "pr-3" : "pr-3 text-right",
                      i === 3 && "pr-0",
                    )}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr
                key={b.periode}
                className="border-b border-border-subtle last:border-0"
              >
                <th scope="row" className="py-2 pr-3 text-left font-semibold">
                  {periodePanjang(b.periode)}
                  {b.menunggu > 0 ? (
                    <span className="block text-[11px] leading-[14px] font-normal text-warn-text">
                      {rupiahRingkas(b.menunggu)} menunggu keputusan
                    </span>
                  ) : null}
                </th>
                <td className="tabular py-2 pr-3 text-right text-muted-foreground">
                  {rupiahRingkas(b.pagu)}
                </td>
                <td className="tabular py-2 pr-3 text-right">
                  {b.tambahan === 0 ? "—" : `+${rupiahRingkas(b.tambahan)}`}
                </td>
                <td className="tabular py-2 text-right font-semibold">
                  {rupiahRingkas(b.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * Riwayat pagu & alokasi sebagai satu deret peristiwa.
 *
 * Pertanyaan yang dijawab halaman ini adalah "kenapa pagu pos ini
 * segitu" — dan jawabannya selalu berupa urutan: ditetapkan sekian,
 * lalu ditambah sekian karena alasan tertentu. Dua daftar terpisah
 * memaksa pembacanya menyusun urutan itu sendiri.
 */
export function DeretPeristiwa({ baris }: { baris: PeristiwaAnggaran[] }) {
  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-1 px-5">
        <h2 className="text-base leading-6 font-semibold">
          Riwayat pagu &amp; alokasi
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Terbaru lebih dulu. Pagu diurutkan pada awal periodenya karena
          penetapannya tidak menyimpan waktu.
        </p>
      </div>

      {baris.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada pagu maupun pengajuan alokasi yang tercatat.
        </p>
      ) : (
        <ol className="space-y-2 px-5">
          {baris.map((p) => {
            const pagu = p.jenisPeristiwa === "pagu";
            const Ikon = pagu ? CircleDollarSign : PlusCircle;
            return (
              <li
                key={p.id}
                className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-2xl",
                    pagu
                      ? "bg-info-fill text-info-text"
                      : "bg-accentmuted-fill text-accentmuted-text",
                  )}
                >
                  <Ikon className="size-4" aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-[13px] leading-[18px] font-semibold">
                      {judulPeristiwa(p)}
                    </span>
                    {p.status ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
                          GAYA_STATUS_ALOKASI[p.status],
                        )}
                      >
                        {LABEL_STATUS_ALOKASI[p.status]}
                      </span>
                    ) : null}
                  </p>
                  <p className="tabular text-[11px] leading-[14px] text-muted-foreground">
                    {periodePanjang(p.periode)}
                    {p.jenisPeristiwa === "alokasi"
                      ? ` · diajukan ${tanggalPendek(p.pada.slice(0, 10))}`
                      : ""}
                    {p.oleh ? ` · ${p.oleh}` : ""}
                  </p>
                  {p.keterangan ? (
                    <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                      {p.keterangan}
                    </p>
                  ) : null}
                </div>

                <span className="tabular shrink-0 text-right text-[13px] leading-[18px] font-semibold">
                  {pagu ? "" : "+"}
                  {rupiahPenuh(p.jumlah)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
