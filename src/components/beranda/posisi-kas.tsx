import Link from "next/link";
import { Banknote, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen, rupiahRingkas } from "@/lib/format";
import {
  BATAS_KAS_CEO,
  penyetujuiWajib,
  type RingkasKeuangan,
} from "@/lib/keuangan";

/**
 * Posisi kas di Beranda.
 *
 * PRD §1 menyebut satu pertanyaan yang harus terjawab sekali lihat:
 * "hari ini kita di mana?" Untuk yang memegang angka perusahaan, sebagian
 * jawabannya adalah kas — terutama saat kas menipis dan setiap
 * pengeluaran naik ke meja CEO.
 */
export function PosisiKas({ ringkas }: { ringkas: RingkasKeuangan }) {
  const kasTipis = ringkas.saldoKas < BATAS_KAS_CEO;
  const rugi = ringkas.labaBersih < 0;

  return (
    <Card
      className={cn(
        "kartu-interaktif rounded-3xl shadow-card ring-border-subtle",
        kasTipis && "bg-warn-fill ring-0",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5">
        <h2
          className={cn(
            "flex items-center gap-2 text-base leading-6 font-semibold",
            kasTipis && "text-warn-text",
          )}
        >
          <Banknote className="size-4" />
          Posisi kas
        </h2>
        <Link
          href="/keuangan"
          className={cn(
            "tekan-halus sentuh-nyaman shrink-0 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
            kasTipis
              ? "text-warn-text"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Keuangan
        </Link>
      </div>

      <div className="px-5">
        <p
          className={cn(
            "tabular text-2xl leading-8 font-bold tracking-tight",
            kasTipis && "text-warn-text",
          )}
        >
          {rupiahRingkas(ringkas.saldoKas)}
        </p>
        <p
          className={cn(
            "flex items-center gap-1.5 text-[13px] leading-[18px] text-pretty",
            kasTipis ? "text-warn-text" : "text-muted-foreground",
          )}
        >
          {rugi ? (
            <TrendingDown className="size-3.5 shrink-0" />
          ) : (
            <TrendingUp className="size-3.5 shrink-0" />
          )}
          Laba bersih {rupiahRingkas(ringkas.labaBersih)} · NPM{" "}
          {persen(ringkas.npm)}
        </p>
      </div>

      <p
        className={cn(
          "mx-5 rounded-2xl px-4 py-2.5 text-[11px] leading-[14px] text-pretty",
          kasTipis
            ? "bg-card text-warn-text"
            : "bg-muted text-muted-foreground",
        )}
      >
        {kasTipis
          ? `Kas di bawah ${rupiahRingkas(BATAS_KAS_CEO)}: seluruh pengeluaran wajib disetujui ${penyetujuiWajib(ringkas.saldoKas)}.`
          : `Pengeluaran cukup disetujui ${penyetujuiWajib(ringkas.saldoKas)}.`}
        {ringkas.menungguPersetujuan > 0
          ? ` ${rupiahRingkas(ringkas.menungguPersetujuan)} menunggu persetujuan.`
          : ""}
      </p>
    </Card>
  );
}
