"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  GAYA_STATUS_MASUKAN,
  LABEL_STATUS_MASUKAN,
  type Masukan,
  type StatusMasukan,
} from "@/lib/masukan";
import { ubahStatusMasukan } from "@/app/actions/masukan";

/**
 * Langkah status yang masuk akal dari keadaan sekarang.
 * Status yang bisa dilompati semaunya membuat papan ini tidak berarti.
 */
const LANJUTAN: Record<StatusMasukan, StatusMasukan[]> = {
  baru: ["ditinjau", "dikerjakan", "ditolak"],
  ditinjau: ["dikerjakan", "ditolak"],
  dikerjakan: ["selesai", "ditinjau"],
  selesai: ["dikerjakan"],
  ditolak: ["ditinjau"],
};

/**
 * Tombol tindak lanjut pengelola.
 *
 * Semua laporan dikerjakan sendiri oleh pengembangnya, jadi tidak ada
 * penanggung jawab yang perlu dipilih: satu ketukan langsung memindahkan
 * statusnya. Hanya penolakan yang berhenti sebentar untuk meminta alasan,
 * karena alasan itulah yang dibaca pelapornya.
 */
export function TombolStatusMasukan({ masukan }: { masukan: Masukan }) {
  const [menolak, setMenolak] = useState(false);
  const [alasan, setAlasan] = useState(masukan.alasanTolak);
  const [menuju, setMenuju] = useState<StatusMasukan | null>(null);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  const alasanCukup = alasan.trim().length >= 10;

  const simpan = (status: StatusMasukan) => {
    if (menyimpan) return;
    setMenuju(status);
    mulai(async () => {
      setPesan(null);
      const hasil = await ubahStatusMasukan({
        masukanId: masukan.id,
        status,
        alasanTolak: status === "ditolak" ? alasan : undefined,
      });
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
      if (hasil.ok) setMenolak(false);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {LANJUTAN[masukan.status].map((ke) => {
          const gaya = GAYA_STATUS_MASUKAN[ke];
          return (
            <button
              key={ke}
              type="button"
              disabled={menyimpan}
              onClick={() => {
                if (ke === "ditolak") {
                  setPesan(null);
                  setMenolak(true);
                } else {
                  simpan(ke);
                }
              }}
              className={cn(
                "tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] leading-[14px] font-semibold disabled:opacity-60",
                gaya.kelas,
              )}
            >
              {menyimpan && menuju === ke ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Tandai {LABEL_STATUS_MASUKAN[ke].toLowerCase()}
            </button>
          );
        })}
      </div>

      {pesan ? (
        <p
          role="status"
          className={cn(
            "rounded-2xl px-4 py-2.5 text-[11px] leading-[14px] text-pretty",
            berhasil
              ? "bg-ok-fill text-ok-text"
              : "bg-warn-fill text-warn-text",
          )}
        >
          {pesan}
        </p>
      ) : null}

      <Dialog open={menolak} onOpenChange={setMenolak}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak laporan ini?</DialogTitle>
            <DialogDescription>
              Alasannya akan terlihat pelapor — itulah yang menentukan apakah
              ia mau melapor lagi lain kali.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label
              htmlFor={`alasan-tolak-${masukan.id}`}
              className="text-[13px] leading-[18px] font-semibold"
            >
              Alasan penolakan
            </label>
            <textarea
              id={`alasan-tolak-${masukan.id}`}
              value={alasan}
              maxLength={300}
              rows={3}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Mis. sudah ditangani lewat jalur lain, atau di luar cakupan aplikasi"
              className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {!alasanCukup ? (
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                Minimal 10 huruf.
              </p>
            ) : null}
          </div>

          {pesan && !berhasil ? (
            <p
              role="status"
              className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-warn-text"
            >
              {pesan}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="tekan-halus rounded-full"
              >
                Batal
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={!alasanCukup || menyimpan}
              onClick={() => simpan("ditolak")}
              className="tekan-halus rounded-full"
            >
              {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
              Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Panel tindak lanjut di halaman detail masukan. */
export function PanelStatusMasukan({ masukan }: { masukan: Masukan }) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Tindak lanjut</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Sekarang{" "}
          <span className="font-semibold">
            {LABEL_STATUS_MASUKAN[masukan.status].toLowerCase()}
          </span>
          . Setiap perubahan tercatat dan terlihat pelapornya.
        </p>
      </div>

      <div className="px-5">
        <TombolStatusMasukan masukan={masukan} />
      </div>
    </Card>
  );
}
