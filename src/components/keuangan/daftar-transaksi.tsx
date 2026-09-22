import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import { TombolUbahTransaksi } from "@/components/keuangan/tombol-ubah-transaksi";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas, tanggalPendek } from "@/lib/format";
import {
  GAYA_STATUS_TRANSAKSI,
  LABEL_JENIS_KELUAR,
  LABEL_STATUS_TRANSAKSI,
  type Transaksi,
} from "@/lib/keuangan";
import type { PilihanOrganisasi } from "@/lib/types";
import { KeadaanKosong } from "@/components/shared/keadaan";

/**
 * Transaksi terbaru.
 *
 * Arah uang ditandai lebih dulu daripada nominalnya: "keluar 24 juta"
 * dan "masuk 24 juta" terlihat mirip kalau hanya angkanya yang menonjol.
 */
export function DaftarTransaksi({
  daftar,
  judul = "Transaksi terbaru",
  pilihan,
  saldoKas = 0,
}: {
  daftar: Transaksi[];
  judul?: string;
  /** Diisi bila pengajuan yang masih menunggu boleh dibetulkan di sini. */
  pilihan?: PilihanOrganisasi;
  saldoKas?: number;
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">{judul}</h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          {daftar.length} transaksi
        </p>
      </div>

      {daftar.length === 0 ? (
        <KeadaanKosong
          sisip
          className="px-5"
          ikon={<Receipt className="size-4" />}
          judul="Belum ada transaksi pada periode ini"
          pesan="Ganti periode di atas, atau catat transaksi baru bila memang belum ada yang masuk."
        />
      ) : (
        <ul className="space-y-2 px-5">
          {daftar.map((t) => {
            const masuk = t.arah === "masuk";
            return (
              <li
                key={t.id}
                className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3.5"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-2xl",
                    masuk
                      ? "bg-ok-fill text-ok-text"
                      : "bg-card text-muted-foreground",
                  )}
                >
                  {masuk ? (
                    <ArrowDownLeft className="size-4" />
                  ) : (
                    <ArrowUpRight className="size-4" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-[18px] font-semibold text-pretty">
                    <Link
                      href={`/keuangan/${t.id}`}
                      className="hover:underline"
                    >
                      {t.keterangan}
                    </Link>
                  </span>
                  <span className="block text-[11px] leading-[14px] text-muted-foreground">
                    {tanggalPendek(t.tanggal)} · {t.unitNama}
                    {t.jenis ? ` · ${LABEL_JENIS_KELUAR[t.jenis]}` : ""}
                    {t.akunUsername ? ` · ${t.akunUsername}` : ""}
                  </span>
                  <span
                    className={cn(
                      "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
                      GAYA_STATUS_TRANSAKSI[t.status],
                    )}
                  >
                    {LABEL_STATUS_TRANSAKSI[t.status]}
                  </span>
                </span>

                <span
                  className={cn(
                    "tabular shrink-0 text-right text-[13px] leading-[18px] font-semibold",
                    masuk ? "text-ok-text" : undefined,
                  )}
                >
                  {masuk ? "+" : "−"}
                  {rupiahRingkas(t.jumlah)}
                </span>

                {pilihan && t.status === "diajukan" ? (
                  <TombolUbahTransaksi
                    transaksi={t}
                    pilihan={pilihan}
                    saldoKas={saldoKas}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
