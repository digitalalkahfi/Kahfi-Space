"use client";

import { useState, useTransition } from "react";
import { Loader2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ubahStatusAnggota } from "@/app/actions/anggota";
import type { AnggotaTim } from "@/lib/types";

/**
 * Menonaktifkan atau mengaktifkan kembali seorang anggota.
 *
 * Tidak ada penghapusan: laporan harian, absensi, dan skor KPI orang itu
 * adalah riwayat perusahaan. Menonaktifkan juga melepaskan akun yang ia
 * pegang (migrasi 0042), dan akibat itu disebutkan sebelum disimpan.
 */
export function TombolStatusAnggota({
  anggota,
  gaya = "ikon",
}: {
  anggota: AnggotaTim;
  gaya?: "ikon" | "penuh";
}) {
  const [buka, setBuka] = useState(false);
  const [mengubah, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const akanNonaktif = anggota.status === "aktif";

  const alihkan = () =>
    mulai(async () => {
      setPesan(null);
      const hasil = await ubahStatusAnggota(
        anggota.id,
        akanNonaktif ? "nonaktif" : "aktif",
      );
      if (!hasil.ok) setPesan(hasil.pesan ?? null);
      setBuka(false);
    });

  return (
    <>
      {gaya === "ikon" ? (
        <Button
          type="button"
          variant="ghost"
          disabled={mengubah}
          aria-label={
            akanNonaktif
              ? `Nonaktifkan ${anggota.nama}`
              : `Aktifkan ${anggota.nama}`
          }
          onClick={() => setBuka(true)}
          className="tekan-halus sentuh-nyaman size-8 shrink-0 rounded-full p-0"
        >
          {mengubah ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Power className="size-3.5" />
          )}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={mengubah}
          onClick={() => setBuka(true)}
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          {mengubah ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Power className="size-3.5" />
          )}
          {akanNonaktif ? "Nonaktifkan" : "Aktifkan kembali"}
        </Button>
      )}

      {pesan ? (
        <p
          role="status"
          className="basis-full rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text"
        >
          {pesan}
        </p>
      ) : null}

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {akanNonaktif ? "Nonaktifkan" : "Aktifkan"} {anggota.nama}?
            </DialogTitle>
            <DialogDescription>
              {akanNonaktif
                ? `Ia berhenti muncul di penugasan, absensi, dan scorecard${
                    anggota.akunDipegang > 0
                      ? `, dan ${anggota.akunDipegang} akun yang ia pegang akan menunggu PIC baru`
                      : ""
                  }. Seluruh riwayatnya tetap tersimpan.`
                : "Ia kembali masuk hitungan penugasan, absensi, dan scorecard. Akun yang dulu ia pegang perlu ditunjuk ulang."}
            </DialogDescription>
          </DialogHeader>

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
              disabled={mengubah}
              onClick={alihkan}
              className="tekan-halus rounded-full"
            >
              {mengubah ? <Loader2 className="size-4 animate-spin" /> : null}
              {akanNonaktif ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
