"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GAYA_DAMPAK, LABEL_DAMPAK, type DampakMasalah } from "@/lib/masalah";
import { laporkanMasalah } from "@/app/actions/masalah";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

const DAMPAK: DampakMasalah[] = ["rendah", "sedang", "tinggi"];

/**
 * Laporkan masalah baru.
 *
 * Yang diminta sengaja sedikit: judul, konteks, unit, dampak. Solusinya
 * bukan urusan pelapor — meminta orang menuliskan jalan keluar sebelum
 * masalahnya diterima siapa pun hanya menghasilkan jawaban asal supaya
 * formnya bisa ditutup, dan laporan yang tidak pernah dikirim.
 */
export function DialogTambahMasalah({
  pilihan,
  unitBawaan,
}: {
  pilihan: PilihanOrganisasi;
  unitBawaan: KodeUnit | null;
}) {
  const [buka, setBuka] = useState(false);
  const [judul, setJudul] = useState("");
  const [konteks, setKonteks] = useState("");
  const [unitKode, setUnitKode] = useState<KodeUnit | null>(unitBawaan);
  const [dampak, setDampak] = useState<DampakMasalah>("sedang");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const siap = judul.trim().length >= 10;

  const simpan = () => {
    if (!siap || menyimpan) return;
    mulai(async () => {
      setPesan(null);
      const hasil = await laporkanMasalah({ judul, konteks, unitKode, dampak });
      if (hasil.ok || hasil.kode === "demo") {
        setJudul("");
        setKonteks("");
        setBuka(false);
        if (!hasil.ok) setPesan(hasil.pesan ?? null);
        return;
      }
      setPesan(hasil.pesan ?? null);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <Plus className="size-3.5" />
          Laporkan masalah
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Laporkan masalah</DialogTitle>
          <DialogDescription>
            Cukup catat apa yang terjadi. Penelusuran sebabnya dikerjakan
            setelah ini, bertingkat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="judul-masalah"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Apa yang terjadi
            </label>
            <input
              id="judul-masalah"
              value={judul}
              maxLength={160}
              autoComplete="off"
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Mis. GMV akun beauty turun 3 pekan berturut-turut"
              className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
              Sebutkan yang bisa diukur bila ada — angka membuat masalahnya bisa
              dipastikan selesai atau belum.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="konteks-masalah"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Konteks{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </label>
            <textarea
              id="konteks-masalah"
              value={konteks}
              maxLength={600}
              rows={3}
              onChange={(e) => setKonteks(e.target.value)}
              placeholder="Sejak kapan, seberapa besar, siapa yang terdampak"
              className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Unit terdampak
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
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              Kosongkan bila masalahnya lintas unit.
            </p>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Dampak
            </legend>
            <div className="flex flex-wrap gap-1">
              {DAMPAK.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDampak(d)}
                  aria-pressed={d === dampak}
                  className={cn(
                    "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                    d === dampak
                      ? "bg-primary text-primary-foreground"
                      : GAYA_DAMPAK[d],
                  )}
                >
                  {LABEL_DAMPAK[d]}
                </button>
              ))}
            </div>
          </fieldset>

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
            {menyimpan ? "Menyimpan…" : "Laporkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
