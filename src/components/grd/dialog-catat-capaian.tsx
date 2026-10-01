"use client";

import { useState, useTransition } from "react";
import { Loader2, PencilLine } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { angka, bacaAngka, tanggalKalenderPanjang } from "@/lib/format";
import { tampilNilaiGoal } from "@/lib/goal";
import { isiCapaianUkuran } from "@/app/actions/kurva";

/**
 * Mencatat capaian KUMULATIF ukuran GRD isian pada satu tanggal — total
 * sejak awal periode, bukan tambahan hari itu (mis. "13 seller aktif").
 *
 * `tanggalTetap` dipakai kurva WRM: AKTUAL sebuah Sabtu dicatat pada
 * tanggal Sabtu itu sendiri. Tanpanya, tanggalnya bisa dipilih (bawaan:
 * hari ini).
 */
export function DialogCatatCapaian({
  ukuranId,
  judul,
  satuan,
  acuan,
  tanggalTetap,
  nilaiAwal = null,
  label = "Catat capaian",
  kecil = false,
}: {
  ukuranId: string;
  judul: string;
  satuan: string;
  acuan: string;
  tanggalTetap?: string;
  nilaiAwal?: number | null;
  label?: string;
  kecil?: boolean;
}) {
  const [buka, setBuka] = useState(false);
  const [tanggal, setTanggal] = useState(tanggalTetap ?? acuan);
  const [teks, setTeks] = useState("");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const dibaca = bacaAngka(teks);
  const salah = dibaca !== null && Number.isNaN(dibaca);
  const siap = !salah && (dibaca !== null || nilaiAwal !== null);

  const bukaDialog = (b: boolean) => {
    if (b) {
      setTanggal(tanggalTetap ?? acuan);
      setTeks(nilaiAwal === null ? "" : angka(nilaiAwal, 6));
      setPesan(null);
    }
    setBuka(b);
  };

  const simpan = () => {
    if (!siap || menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await isiCapaianUkuran({
        ukuranId,
        tanggal,
        nilai: dibaca,
      });
      if (hasil.ok) {
        setBuka(false);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={bukaDialog}>
      <Button
        type="button"
        variant="outline"
        onClick={() => bukaDialog(true)}
        className={cn(
          "tekan-halus shrink-0 rounded-full font-semibold",
          kecil ? "h-7 px-2.5 text-[10px]" : "h-8 px-3 text-[11px]",
        )}
      >
        <PencilLine className="size-3.5" />
        {label}
      </Button>

      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat capaian</DialogTitle>
          <DialogDescription className="text-pretty">
            {judul}. Isi angka total sampai tanggal ini, bukan tambahan hari itu
            saja.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {tanggalTetap ? (
            <p className="text-[13px] leading-[18px] font-semibold">
              {tanggalKalenderPanjang(tanggalTetap)}
            </p>
          ) : (
            <div className="space-y-1.5">
              <label
                htmlFor={`tanggal-${ukuranId}`}
                className="text-[13px] leading-[18px] font-semibold"
              >
                Tanggal
              </label>
              <input
                id={`tanggal-${ukuranId}`}
                type="date"
                value={tanggal}
                max={acuan}
                onChange={(e) => setTanggal(e.target.value)}
                className="h-11 w-full rounded-xl bg-muted px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label
              htmlFor={`nilai-${ukuranId}`}
              className="text-[13px] leading-[18px] font-semibold"
            >
              Capaian ({satuan === "IDR" ? "rupiah" : satuan})
            </label>
            <input
              id={`nilai-${ukuranId}`}
              inputMode="decimal"
              autoComplete="off"
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              placeholder="kosong"
              aria-invalid={salah || undefined}
              className={cn(
                "tabular h-11 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40",
                salah && "ring-2 ring-danger/60",
              )}
            />
            <p
              className={cn(
                "tabular text-[11px] leading-[14px]",
                salah ? "text-danger-text" : "text-muted-foreground",
              )}
            >
              {salah
                ? "Tidak terbaca. Pakai koma untuk desimal, mis. 12,5."
                : dibaca === null
                  ? nilaiAwal !== null
                    ? "Dikosongkan: catatan tanggal ini dihapus."
                    : "Belum diisi."
                  : `Dibaca ${tampilNilaiGoal(dibaca, satuan)}.`}
            </p>
          </div>

          {pesan ? (
            <p
              role="status"
              className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text"
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
              Batal
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={!siap || menyimpan}
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            {menyimpan ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
