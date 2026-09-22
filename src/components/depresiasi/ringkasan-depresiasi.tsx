import { CalendarClock, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { rupiahRingkas } from "@/lib/format";
import { ringkasDepresiasi, type BarisDepresiasi } from "@/lib/depresiasi";

/**
 * Beban penyusutan satu periode.
 *
 * Pengaruhnya terhadap laba dan NPM punya kartunya sendiri
 * (`DampakDepresiasi`) supaya keduanya tidak dihitung di dua tempat.
 */
export function RingkasanDepresiasi({
  baris,
  periode,
}: {
  baris: BarisDepresiasi[];
  periode: string;
}) {
  const r = ringkasDepresiasi(baris);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <TrendingDown className="size-4 text-muted-foreground" />
          Beban penyusutan {periode}
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {r.jumlahAset} aset masih menyusut. Angka ini bukan kas keluar —
          uangnya sudah keluar saat barangnya dibeli.
        </p>
      </div>

      <div className="tabular px-5">
        <div className="rounded-2xl bg-muted/50 p-3.5">
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Beban bulan ini
          </p>
          <p className="text-[22px] leading-7 font-bold tracking-tight">
            {rupiahRingkas(r.beban)}
          </p>
          <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
            Akumulasi {rupiahRingkas(r.akumulasi)} · nilai buku tersisa{" "}
            {rupiahRingkas(r.nilaiBuku)}
          </p>
        </div>
      </div>

      {r.segeraHabis > 0 ? (
        <p className="mx-5 flex items-center gap-2 rounded-2xl bg-warn-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-warn-text">
          <CalendarClock className="size-3.5 shrink-0" />
          {r.segeraHabis} aset habis masa manfaatnya dalam tiga bulan — bebannya
          akan berhenti, dan penggantinya belum tentu sudah dianggarkan.
        </p>
      ) : null}
    </Card>
  );
}
