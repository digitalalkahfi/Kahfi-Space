"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
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
import { jamWib, tanggalPanjang, tanggalPendek } from "@/lib/format";
import { ubahStatusKspaceLama } from "@/app/actions/migrasi";
import type { KejadianLama, StatusLama } from "@/lib/data/migrasi";

/**
 * Membekukan K-Space lama.
 *
 * Aplikasi ini tidak bisa mengunci server lama; yang bisa dilakukan
 * adalah memasang pengingat di setiap halaman agar tidak ada lagi yang
 * mencatat di tempat yang salah. Itu dikatakan apa adanya di sini,
 * supaya tidak ada yang mengira sistem lamanya benar-benar terkunci.
 */
export function PanelKspaceLama({
  status,
  riwayat = [],
}: {
  status: StatusLama;
  /** Riwayat pembekuan; jendela saat sistem lama sempat dibuka penting. */
  riwayat?: KejadianLama[];
}) {
  const [buka, setBuka] = useState(false);
  const [url, setUrl] = useState(status.url);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  const ubah = (readonly: boolean) =>
    mulai(async () => {
      setPesan(null);
      const hasil = await ubahStatusKspaceLama({ readonly, url });
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
      setBuka(false);
    });

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
            {status.readonly ? (
              <Archive className="size-4 text-muted-foreground" />
            ) : (
              <ArchiveRestore className="size-4 text-muted-foreground" />
            )}
            K-Space lama
          </h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {status.readonly
              ? `Ditandai hanya-baca${
                  status.pada ? ` sejak ${tanggalPanjang(status.pada)}` : ""
                }${status.olehNama ? ` oleh ${status.olehNama}` : ""}.`
              : "Belum ditandai. Selama dua sistem sama-sama terbuka, ada risiko laporan masuk ke tempat yang tidak ikut pindah."}
          </p>
        </div>

        <Button
          type="button"
          variant={status.readonly ? "outline" : "default"}
          disabled={menyimpan}
          onClick={() => setBuka(true)}
          className="tekan-halus sentuh-nyaman h-9 shrink-0 rounded-full px-4 text-[11px] font-semibold"
        >
          {menyimpan ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {status.readonly ? "Buka kembali" : "Tandai hanya-baca"}
        </Button>
      </div>

      <div className="space-y-1.5 px-5">
        <label
          htmlFor="url-lama"
          className="text-[13px] leading-[18px] font-semibold"
        >
          Alamat arsip K-Space lama{" "}
          <span className="font-normal text-muted-foreground">(opsional)</span>
        </label>
        <input
          id="url-lama"
          value={url}
          maxLength={200}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://lama.k-space.test"
          className="h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
          Bila diisi, pengingat di setiap halaman menautkan ke sana untuk
          melihat data lama.
        </p>
      </div>

      {pesan ? (
        <p
          role="status"
          className={
            berhasil
              ? "mx-5 rounded-2xl bg-ok-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-ok-text"
              : "mx-5 rounded-2xl bg-warn-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-warn-text"
          }
        >
          {pesan}
        </p>
      ) : null}

      {riwayat.length > 0 ? (
        <div className="px-5">
          <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Riwayat
          </p>
          <ol className="mt-1.5 space-y-1">
            {riwayat.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-[11px] leading-[14px]"
              >
                <span className="font-semibold">
                  {k.readonly ? "Dibekukan" : "Dibuka kembali"}
                  {k.olehNama ? ` oleh ${k.olehNama}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {tanggalPendek(k.pada.slice(0, 10))} · {jamWib(k.pada)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {status.readonly
                ? "Buka kembali K-Space lama?"
                : "Tandai K-Space lama hanya-baca?"}
            </DialogTitle>
            <DialogDescription>
              {status.readonly
                ? "Pengingat di setiap halaman akan hilang. Lakukan ini hanya kalau pencatatan memang kembali ke sistem lama."
                : "Aplikasi ini tidak bisa mengunci server lama — yang dilakukan adalah memasang pengingat di setiap halaman bahwa pencatatan sudah pindah ke sini. Kuncian sungguhannya tetap perlu dikerjakan di sistem lama."}
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
              disabled={menyimpan}
              onClick={() => ubah(!status.readonly)}
              className="tekan-halus rounded-full"
            >
              {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
              {status.readonly ? "Buka kembali" : "Tandai hanya-baca"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
