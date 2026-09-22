"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { tanggalPanjang } from "@/lib/format";
import {
  GAYA_JENIS_AGENDA,
  LABEL_JENIS_AGENDA,
  type EntriKalender,
} from "@/lib/kalender";
import { hapusAgenda } from "@/app/actions/kalender";
import { DialogUbahAgenda } from "@/components/kalender/dialog-ubah-agenda";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

/**
 * Detail satu entri kalender.
 *
 * Entri yang ditarik dari modul lain tidak bisa disunting di sini — ia
 * hanya menautkan ke sumbernya. Menyunting salinan akan membuat tanggal
 * di kalender berbeda dari tanggal sebenarnya.
 */
export function DetailAgenda({
  entri,
  buka,
  onBuka,
  bolehUbah,
  pilihan,
  unitTerkunci,
}: {
  entri: EntriKalender | null;
  buka: boolean;
  onBuka: (b: boolean) => void;
  /** Boleh menyunting & menghapus; pemeriksaan sebenarnya ada di RLS. */
  bolehUbah: boolean;
  pilihan: PilihanOrganisasi | null;
  unitTerkunci: KodeUnit | null;
}) {
  const [menghapus, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [bukaUbah, setBukaUbah] = useState(false);

  if (!entri) return null;

  const gaya = GAYA_JENIS_AGENDA[entri.jenis];
  const tarikan = entri.sumber !== "agenda";

  const hapus = () =>
    mulai(async () => {
      setPesan(null);
      const hasil = await hapusAgenda(entri.id);
      if (hasil.ok) {
        onBuka(false);
        setKonfirmasi(false);
        return;
      }
      setPesan(hasil.pesan ?? null);
      setKonfirmasi(false);
    });

  return (
    <Dialog
      open={buka}
      onOpenChange={(b) => {
        onBuka(b);
        if (!b) {
          setKonfirmasi(false);
          setPesan(null);
        }
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-pretty">{entri.judul}</DialogTitle>
          <DialogDescription>
            {tarikan
              ? "Ditarik dari modul Tugas — diubah dari sana, bukan dari kalender."
              : "Agenda kalender bersama."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
              gaya.kelas,
            )}
          >
            <span className={cn("size-1.5 rounded-full", gaya.titik)} />
            {LABEL_JENIS_AGENDA[entri.jenis]}
          </span>

          <dl className="space-y-1.5 text-[13px] leading-[18px]">
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <dd>{tanggalPanjang(entri.tanggal)}</dd>
            </div>

            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <dd>
                {entri.jamMulai
                  ? `${entri.jamMulai}${entri.jamSelesai ? `–${entri.jamSelesai}` : ""} WIB`
                  : "Sepanjang hari"}
              </dd>
            </div>

            {entri.lokasi ? (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <dd>{entri.lokasi}</dd>
              </div>
            ) : null}

            {entri.unitNama ? (
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <dd>{entri.unitNama}</dd>
              </div>
            ) : null}

            {entri.dibuatOleh ? (
              <div className="flex items-start gap-2">
                <UserRound className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <dd>Dibuat {entri.dibuatOleh}</dd>
              </div>
            ) : null}
          </dl>

          {entri.keterangan ? (
            <p className="rounded-2xl bg-muted px-4 py-3 text-[13px] leading-[20px] text-pretty">
              {entri.keterangan}
            </p>
          ) : null}

          {entri.sumber === "agenda" ? (
            <Link
              href={`/kalender/${entri.id}`}
              className="baris-interaktif flex items-center gap-2 rounded-2xl bg-muted/50 px-4 py-3 text-[13px] leading-[18px] font-semibold"
            >
              <span className="flex-1">
                Buka halaman agenda — tautannya bisa dibagikan
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ) : null}

          {entri.tautan ? (
            <Link
              href={entri.tautan}
              className="baris-interaktif flex items-center gap-2 rounded-2xl bg-muted/50 px-4 py-3 text-[13px] leading-[18px] font-semibold"
            >
              <span className="flex-1">Buka di modul asalnya</span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ) : null}

          {konfirmasi ? (
            <p className="rounded-2xl bg-danger-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-danger-text">
              Agenda ini akan dihapus dari kalender semua orang. Tekan Hapus
              sekali lagi untuk memastikan.
            </p>
          ) : null}

          {pesan ? (
            <p
              role="status"
              className="rounded-2xl bg-warn-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-warn-text"
            >
              {pesan}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="tekan-halus rounded-full"
            >
              Tutup
            </Button>
          </DialogClose>

          {bolehUbah && !tarikan && pilihan ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onBuka(false);
                setBukaUbah(true);
              }}
              className="tekan-halus rounded-full"
            >
              <Pencil className="size-4" />
              Ubah
            </Button>
          ) : null}

          {bolehUbah && !tarikan ? (
            <Button
              type="button"
              disabled={menghapus}
              onClick={() => (konfirmasi ? hapus() : setKonfirmasi(true))}
              className="tekan-halus rounded-full"
            >
              {menghapus ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {konfirmasi ? "Hapus sekarang" : "Hapus agenda"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>

      {pilihan && !tarikan ? (
        <DialogUbahAgenda
          entri={entri}
          pilihan={pilihan}
          unitTerkunci={unitTerkunci}
          buka={bukaUbah}
          onBuka={setBukaUbah}
        />
      ) : null}
    </Dialog>
  );
}
