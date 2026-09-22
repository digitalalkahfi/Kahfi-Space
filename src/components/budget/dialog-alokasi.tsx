"use client";

import { useState, useTransition } from "react";
import { HandCoins, Loader2 } from "lucide-react";
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
import { ajukanAlokasi } from "@/app/actions/alokasi";
import { periksaAlokasi, type MasukanAlokasi } from "@/lib/budget";
import { LABEL_JENIS_KELUAR, type JenisKeluar } from "@/lib/keuangan";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

const JENIS: JenisKeluar[] = [
  "beban",
  "aset",
  "direct_cost",
  "creator_share",
  "dividen",
];

function keAngka(teks: string) {
  const bersih = teks.replace(/[^\d]/g, "");
  return bersih === "" ? 0 : Number(bersih);
}

/**
 * Pengajuan tambahan pagu.
 *
 * Statusnya tidak bisa dipilih di sini — selalu "diajukan". Yang
 * memutuskan orang lain, dan itulah inti persetujuan berjenjang.
 */
export function DialogAlokasi({
  pilihan,
  periodeBawaan,
  unitBawaan,
}: {
  pilihan: PilihanOrganisasi;
  periodeBawaan: string;
  unitBawaan: KodeUnit | null;
}) {
  const [buka, setBuka] = useState(false);
  const [periode, setPeriode] = useState(periodeBawaan);
  const [unitKode, setUnitKode] = useState<KodeUnit | null>(unitBawaan);
  const [jenis, setJenis] = useState<JenisKeluar>("beban");
  const [jumlah, setJumlah] = useState("");
  const [alasan, setAlasan] = useState("");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const masukan: MasukanAlokasi = {
    periode,
    unitKode,
    jenis,
    jumlah: keAngka(jumlah),
    alasan,
  };
  const salah = periksaAlokasi(masukan);

  const pil = (aktif: boolean, label: string, saatKlik: () => void) => (
    <button
      key={label}
      type="button"
      onClick={saatKlik}
      aria-pressed={aktif}
      className={cn(
        "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
        aktif
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  const isian =
    "h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40";
  const label = "text-[13px] leading-[18px] font-semibold";

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <HandCoins className="size-3.5" />
          Ajukan alokasi
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajukan tambahan pagu</DialogTitle>
          <DialogDescription>
            Pengajuan masuk berstatus menunggu keputusan; yang memutuskan
            Manager atau CEO.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="periode-alokasi" className={label}>
              Periode
            </label>
            <input
              id="periode-alokasi"
              type="month"
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              className={cn(isian, "tabular")}
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className={label}>Divisi</legend>
            <div className="flex flex-wrap gap-1">
              {pil(unitKode === null, "Perusahaan", () => setUnitKode(null))}
              {pilihan.unit.map((u) =>
                pil(unitKode === u.kode, u.nama, () => setUnitKode(u.kode)),
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className={label}>Jenis pengeluaran</legend>
            <div className="flex flex-wrap gap-1">
              {JENIS.map((j) =>
                pil(jenis === j, LABEL_JENIS_KELUAR[j], () => setJenis(j)),
              )}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="jumlah-alokasi" className={label}>
              Tambahan yang diminta (Rp)
            </label>
            <input
              id="jumlah-alokasi"
              inputMode="numeric"
              value={jumlah}
              onChange={(e) =>
                setJumlah(keAngka(e.target.value).toLocaleString("id-ID"))
              }
              placeholder="0"
              className={cn(isian, "tabular")}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="alasan-alokasi" className={label}>
              Alasan
            </label>
            <textarea
              id="alasan-alokasi"
              value={alasan}
              rows={3}
              maxLength={300}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Apa yang membuat pagu sekarang tidak cukup?"
              className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
              Yang memutuskan tidak ikut menjalankan pekerjaannya — tanpa alasan
              ia hanya bisa menebak.
            </p>
          </div>

          {salah && (jumlah !== "" || alasan !== "") ? (
            <p className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-warn-text">
              {salah}
            </p>
          ) : null}

          {pesan ? (
            <p
              role="status"
              className="rounded-xl bg-muted px-3 py-2 text-[11px] leading-[14px] text-pretty text-muted-foreground"
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
          <Button
            type="button"
            disabled={salah !== null || menyimpan}
            onClick={() =>
              mulai(async () => {
                setPesan(null);
                const hasil = await ajukanAlokasi(masukan);
                setPesan(hasil.pesan ?? null);
                if (hasil.ok) {
                  setJumlah("");
                  setAlasan("");
                }
              })
            }
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            Ajukan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
