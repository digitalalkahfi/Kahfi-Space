"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { putuskanAlokasi } from "@/app/actions/alokasi";
import {
  izinPutusAlokasi,
  penyetujuAlokasi,
  type AlokasiAnggaran,
} from "@/lib/budget";

/**
 * Keputusan atas satu pengajuan alokasi.
 *
 * Wewenangnya diperiksa di layar memakai fungsi yang sama dengan server,
 * supaya alasan penolakan terbaca sebelum tombolnya ditekan — bukan
 * sesudah. Penolakan menuntut alasan lebih dulu.
 */
export function AksiAlokasi({
  alokasi,
  peran,
  namaSaya,
}: {
  alokasi: AlokasiAnggaran;
  peran: string;
  namaSaya: string;
}) {
  const [memproses, mulai] = useTransition();
  const [menolak, setMenolak] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);

  const izin = izinPutusAlokasi(peran, namaSaya, alokasi);
  const wajib = penyetujuAlokasi(alokasi.jumlah);

  if (alokasi.status !== "diajukan") return null;

  if (!izin.bolehPutuskan) {
    return (
      <p className="mt-2 text-[11px] leading-[14px] text-pretty text-muted-foreground">
        {izin.alasan} Menunggu {wajib}.
      </p>
    );
  }

  const putuskan = (keputusan: "disetujui" | "ditolak") =>
    mulai(async () => {
      setPesan(null);
      const hasil = await putuskanAlokasi({
        alokasiId: alokasi.id,
        keputusan,
        catatan: keputusan === "ditolak" ? alasan : undefined,
      });
      setPesan(hasil.pesan ?? null);
      if (hasil.ok) {
        setMenolak(false);
        setAlasan("");
      }
    });

  return (
    <div className="mt-2 space-y-2">
      {menolak ? (
        <textarea
          value={alasan}
          rows={2}
          maxLength={200}
          onChange={(e) => setAlasan(e.target.value)}
          placeholder="Alasan penolakan — apa yang perlu diperbaiki?"
          className="w-full rounded-xl bg-card px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={memproses}
          onClick={() => putuskan("disetujui")}
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
          disabled={memproses || (menolak && alasan.trim().length < 10)}
          onClick={() => (menolak ? putuskan("ditolak") : setMenolak(true))}
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <X className="size-3.5" />
          {menolak ? "Kirim penolakan" : "Tolak"}
        </Button>

        <span className="text-[11px] leading-[14px] text-muted-foreground">
          Wewenang {wajib}
        </span>
      </div>

      {pesan ? (
        <p
          role="status"
          className="rounded-xl bg-card px-3 py-2 text-[11px] leading-[14px] text-pretty text-muted-foreground"
        >
          {pesan}
        </p>
      ) : null}
    </div>
  );
}
