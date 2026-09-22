"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas, tanggalPendek } from "@/lib/format";
import { putuskanPengeluaran } from "@/app/actions/keuangan";
import {
  LABEL_JENIS_KELUAR,
  izinPersetujuan,
  type IzinPersetujuan,
  type Transaksi,
} from "@/lib/keuangan";

/**
 * Antrean pengajuan pengeluaran.
 *
 * Penolakan menuntut alasan sebelum tombolnya hidup: pengajuan yang
 * ditolak tanpa keterangan hanya akan diajukan ulang apa adanya.
 */
export function PanelPersetujuan({
  daftar,
  izin,
  penyetuju,
  penggunaId,
  peran,
  saldoKas,
}: {
  daftar: Transaksi[];
  /** Wewenang umum pengguna ini, tanpa memandang siapa pengajunya. */
  izin: IzinPersetujuan;
  penyetuju: "CEO" | "Manager";
  penggunaId: string;
  peran: string;
  saldoKas: number;
}) {
  const [memproses, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [menolak, setMenolak] = useState<string | null>(null);
  const [alasan, setAlasan] = useState("");

  if (daftar.length === 0) return null;

  const putuskan = (id: string, keputusan: "disetujui" | "ditolak") =>
    mulai(async () => {
      setPesan(null);
      const hasil = await putuskanPengeluaran({
        transaksiId: id,
        keputusan,
        catatan: keputusan === "ditolak" ? alasan : undefined,
      });
      setPesan(hasil.pesan ?? null);
      if (hasil.ok) {
        setMenolak(null);
        setAlasan("");
      }
    });

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Menunggu persetujuan {penyetuju}
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {izin.bolehPutuskan
            ? "Pengeluaran belum mengurangi kas sampai disetujui dan dibayar."
            : izin.alasan}
        </p>
      </div>

      <ul className="space-y-2 px-5">
        {daftar.map((t) => {
          // Wewenang diperiksa per pengajuan: yang menghalangi bisa
          // berbeda tiap baris — pengajuan sendiri, atau kas yang
          // menipis. Basis data menolaknya juga (migrasi 0098); di sini
          // alasannya cukup terbaca sebelum tombolnya ditekan.
          const izinBaris = izinPersetujuan(
            peran,
            penggunaId,
            t.diajukanId,
            saldoKas,
          );
          return (
            <li key={t.id} className="rounded-2xl bg-muted/50 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-[18px] font-semibold text-pretty">
                    {t.keterangan}
                  </span>
                  <span className="block text-[11px] leading-[14px] text-muted-foreground">
                    {tanggalPendek(t.tanggal)} · {t.unitNama}
                    {t.jenis ? ` · ${LABEL_JENIS_KELUAR[t.jenis]}` : ""}
                    {t.diajukanNama ? ` · diajukan ${t.diajukanNama}` : ""}
                  </span>
                </span>
                <span className="tabular shrink-0 text-[13px] leading-[18px] font-semibold">
                  {rupiahRingkas(t.jumlah)}
                </span>
              </div>

              {izinBaris.bolehPutuskan ? (
                <div className="mt-2 space-y-2">
                  {menolak === t.id ? (
                    <textarea
                      value={alasan}
                      rows={2}
                      maxLength={200}
                      onChange={(e) => setAlasan(e.target.value)}
                      placeholder="Alasan penolakan — apa yang perlu diperbaiki?"
                      className="w-full rounded-xl bg-card px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
                    />
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={memproses}
                      onClick={() => putuskan(t.id, "disetujui")}
                      className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
                    >
                      {memproses ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      Setujui
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        memproses ||
                        (menolak === t.id && alasan.trim().length < 10)
                      }
                      onClick={() =>
                        menolak === t.id
                          ? putuskan(t.id, "ditolak")
                          : setMenolak(t.id)
                      }
                      className={cn(
                        "tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold",
                      )}
                    >
                      <X className="size-3.5" />
                      {menolak === t.id ? "Kirim penolakan" : "Tolak"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  {izinBaris.alasan}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {pesan ? (
        <p
          role="status"
          className="mx-5 rounded-2xl bg-muted px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-muted-foreground"
        >
          {pesan}
        </p>
      ) : null}
    </Card>
  );
}
