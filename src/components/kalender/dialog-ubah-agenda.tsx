"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
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
import {
  GAYA_JENIS_AGENDA,
  LABEL_JENIS_AGENDA,
  type EntriKalender,
  type JenisAgenda,
} from "@/lib/kalender";
import { ubahAgenda } from "@/app/actions/kalender";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

const JENIS: JenisAgenda[] = ["rapat", "pelatihan", "libur", "lainnya"];

/**
 * Menyunting agenda yang sudah ada.
 *
 * Entri tarikan dari modul lain tidak pernah sampai ke sini — ia diubah
 * dari sumbernya, supaya tidak ada dua tanggal untuk satu hal.
 */
export function DialogUbahAgenda({
  entri,
  pilihan,
  unitTerkunci,
  buka,
  onBuka,
}: {
  entri: EntriKalender;
  pilihan: PilihanOrganisasi;
  unitTerkunci: KodeUnit | null;
  buka: boolean;
  onBuka: (b: boolean) => void;
}) {
  const [judul, setJudul] = useState(entri.judul);
  const [keterangan, setKeterangan] = useState(entri.keterangan);
  const [jenis, setJenis] = useState<JenisAgenda>(
    entri.jenis === "tenggat" ? "lainnya" : entri.jenis,
  );
  const [tanggal, setTanggal] = useState(entri.tanggal);
  const [jamMulai, setJamMulai] = useState(entri.jamMulai ?? "");
  const [jamSelesai, setJamSelesai] = useState(entri.jamSelesai ?? "");
  const [unitKode, setUnitKode] = useState<KodeUnit | null>(entri.unitKode);
  const [lokasi, setLokasi] = useState(entri.lokasi);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const siap =
    judul.trim().length >= 3 &&
    /^\d{4}-\d{2}-\d{2}$/.test(tanggal) &&
    (!jamSelesai || (jamMulai !== "" && jamSelesai > jamMulai));

  const simpan = () => {
    if (!siap || menyimpan) return;
    mulai(async () => {
      setPesan(null);
      const hasil = await ubahAgenda(entri.id, {
        judul,
        keterangan,
        jenis,
        tanggal,
        jamMulai: jamMulai || null,
        jamSelesai: jamSelesai || null,
        unitKode,
        lokasi,
      });

      if (hasil.ok || hasil.kode === "demo") {
        onBuka(false);
        if (!hasil.ok) setPesan(hasil.pesan ?? null);
        return;
      }
      setPesan(hasil.pesan ?? null);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah agenda</DialogTitle>
          <DialogDescription>
            Perubahannya langsung terlihat di kalender semua orang.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="ubah-judul-agenda"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Judul
            </label>
            <input
              id="ubah-judul-agenda"
              value={judul}
              maxLength={140}
              autoComplete="off"
              onChange={(e) => setJudul(e.target.value)}
              className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Jenis
            </legend>
            <div className="flex flex-wrap gap-1">
              {JENIS.map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setJenis(j)}
                  aria-pressed={j === jenis}
                  className={cn(
                    "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                    j === jenis
                      ? "bg-primary text-primary-foreground"
                      : GAYA_JENIS_AGENDA[j].kelas,
                  )}
                >
                  {LABEL_JENIS_AGENDA[j]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label
              htmlFor="ubah-tanggal-agenda"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Tanggal
            </label>
            <input
              id="ubah-tanggal-agenda"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label
                htmlFor="ubah-mulai-agenda"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Jam mulai
              </label>
              <input
                id="ubah-mulai-agenda"
                type="time"
                value={jamMulai}
                onChange={(e) => setJamMulai(e.target.value)}
                className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label
                htmlFor="ubah-selesai-agenda"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Jam selesai
              </label>
              <input
                id="ubah-selesai-agenda"
                type="time"
                value={jamSelesai}
                onChange={(e) => setJamSelesai(e.target.value)}
                className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>

          {unitTerkunci === null ? (
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] leading-[18px] font-semibold">
                Untuk unit
              </legend>
              <div className="flex flex-wrap gap-1">
                {pilihan.unit.map((u) => (
                  <button
                    key={u.kode}
                    type="button"
                    onClick={() =>
                      setUnitKode(unitKode === u.kode ? null : u.kode)
                    }
                    aria-pressed={u.kode === unitKode}
                    className={cn(
                      "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                      u.kode === unitKode
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {u.nama}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="space-y-1.5">
            <label
              htmlFor="ubah-lokasi-agenda"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Lokasi
            </label>
            <input
              id="ubah-lokasi-agenda"
              value={lokasi}
              maxLength={120}
              autoComplete="off"
              onChange={(e) => setLokasi(e.target.value)}
              className="h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="ubah-keterangan-agenda"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Keterangan
            </label>
            <textarea
              id="ubah-keterangan-agenda"
              value={keterangan}
              maxLength={500}
              rows={2}
              onChange={(e) => setKeterangan(e.target.value)}
              className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          {pesan ? (
            <p
              role="status"
              className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-warn-text"
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
            Simpan perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
