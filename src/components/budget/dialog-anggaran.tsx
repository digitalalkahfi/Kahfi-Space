"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
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
import { simpanAnggaran } from "@/app/actions/budget";
import {
  periksaAnggaran,
  type Anggaran,
  type MasukanAnggaran,
} from "@/lib/budget";
import { LABEL_JENIS_KELUAR, type JenisKeluar } from "@/lib/keuangan";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

const JENIS: JenisKeluar[] = [
  "beban",
  "aset",
  "direct_cost",
  "creator_share",
  "dividen",
];

/** Angka berformat Indonesia ("24.500.000") menjadi bilangan. */
function keAngka(teks: string) {
  const bersih = teks.replace(/[^\d]/g, "");
  return bersih === "" ? 0 : Number(bersih);
}

function Isian({
  awal,
  pilihan,
  periodeBawaan,
  menyimpan,
  pesan,
  onSimpan,
}: {
  awal?: Anggaran;
  pilihan: PilihanOrganisasi;
  periodeBawaan: string;
  menyimpan: boolean;
  pesan: string | null;
  onSimpan: (data: MasukanAnggaran) => void;
}) {
  const [periode, setPeriode] = useState(awal?.periode ?? periodeBawaan);
  const [unitKode, setUnitKode] = useState<KodeUnit | null>(
    awal?.unitKode ?? null,
  );
  const [jenis, setJenis] = useState<JenisKeluar>(awal?.jenis ?? "beban");
  const [jumlah, setJumlah] = useState(
    awal ? awal.jumlah.toLocaleString("id-ID") : "",
  );
  const [catatan, setCatatan] = useState(awal?.catatan ?? "");

  const masukan: MasukanAnggaran = {
    periode,
    unitKode,
    jenis,
    jumlah: keAngka(jumlah),
    catatan,
  };
  const salah = periksaAnggaran(masukan);

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
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="periode-anggaran" className={label}>
            Periode
          </label>
          <input
            id="periode-anggaran"
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
          <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
            &quot;Perusahaan&quot; untuk belanja yang memang tidak menempel pada
            satu divisi — gaji dan sewa, misalnya.
          </p>
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
          <label htmlFor="jumlah-anggaran" className={label}>
            Pagu anggaran (Rp)
          </label>
          <input
            id="jumlah-anggaran"
            inputMode="numeric"
            value={jumlah}
            onChange={(e) =>
              setJumlah(keAngka(e.target.value).toLocaleString("id-ID"))
            }
            placeholder="0"
            className={cn(isian, "tabular")}
          />
          <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
            Realisasinya tidak diisi di sini — ia dihitung sendiri dari
            transaksi yang sudah dibayar.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="catatan-anggaran" className={label}>
            Keterangan{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </label>
          <input
            id="catatan-anggaran"
            value={catatan}
            maxLength={200}
            autoComplete="off"
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Mis. iklan akun affiliator"
            className="h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        {salah && jumlah !== "" ? (
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
          onClick={() => onSimpan(masukan)}
          className="tekan-halus rounded-full"
        >
          {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
          {awal ? "Simpan perubahan" : "Tetapkan anggaran"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Menetapkan pagu baru untuk satu periode × divisi × jenis. */
export function DialogTambahAnggaran({
  pilihan,
  periodeBawaan,
}: {
  pilihan: PilihanOrganisasi;
  periodeBawaan: string;
}) {
  const [buka, setBuka] = useState(false);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <Plus className="size-3.5" />
          Tetapkan anggaran
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tetapkan anggaran</DialogTitle>
          <DialogDescription>
            Satu pagu untuk satu periode, divisi, dan jenis pengeluaran.
          </DialogDescription>
        </DialogHeader>

        <Isian
          pilihan={pilihan}
          periodeBawaan={periodeBawaan}
          menyimpan={menyimpan}
          pesan={pesan}
          onSimpan={(data) =>
            mulai(async () => {
              setPesan(null);
              const hasil = await simpanAnggaran(data);
              setPesan(hasil.pesan ?? null);
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/** Membetulkan pagu yang sudah ditetapkan. */
export function DialogUbahAnggaran({
  anggaran,
  pilihan,
}: {
  anggaran: Anggaran;
  pilihan: PilihanOrganisasi;
}) {
  const [buka, setBuka] = useState(false);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={`Ubah anggaran ${anggaran.unitNama}`}
          className="tekan-halus sentuh-nyaman size-8 shrink-0 rounded-full p-0"
        >
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah anggaran</DialogTitle>
          <DialogDescription>
            Pagu boleh dibetulkan; realisasinya tetap mengikuti transaksi.
          </DialogDescription>
        </DialogHeader>

        <Isian
          awal={anggaran}
          pilihan={pilihan}
          periodeBawaan={anggaran.periode}
          menyimpan={menyimpan}
          pesan={pesan}
          onSimpan={(data) =>
            mulai(async () => {
              setPesan(null);
              const hasil = await simpanAnggaran(data, anggaran.id);
              setPesan(hasil.pesan ?? null);
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
