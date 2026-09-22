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
import { tambahAset, ubahAset } from "@/app/actions/aset";
import { periksaAset, type Aset, type MasukanAset } from "@/lib/aset";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

const KATEGORI = [
  "Elektronik",
  "Peralatan studio",
  "Perabot",
  "Kendaraan",
  "Lainnya",
];

/** Angka berformat Indonesia ("24.500.000") menjadi bilangan. */
function keAngka(teks: string) {
  const bersih = teks.replace(/[^\d]/g, "");
  return bersih === "" ? 0 : Number(bersih);
}

function Isian({
  awal,
  pilihan,
  kodeBerikutnya,
  tanggalBawaan,
  onSimpan,
  menyimpan,
  pesan,
}: {
  awal?: Aset;
  pilihan: PilihanOrganisasi;
  kodeBerikutnya: string | null;
  tanggalBawaan: string;
  onSimpan: (data: MasukanAset) => void;
  menyimpan: boolean;
  pesan: string | null;
}) {
  const [kode, setKode] = useState(awal?.kode ?? "");
  const [nama, setNama] = useState(awal?.nama ?? "");
  const [kategori, setKategori] = useState(awal?.kategori ?? "");
  const [unitKode, setUnitKode] = useState<KodeUnit | null>(
    awal?.unitKode ?? null,
  );
  const [tanggal, setTanggal] = useState(awal?.tanggal ?? tanggalBawaan);
  const [nilai, setNilai] = useState(
    awal ? awal.nilaiPerolehan.toLocaleString("id-ID") : "",
  );
  const [masaManfaat, setMasaManfaat] = useState(
    String(awal?.masaManfaat ?? 48),
  );
  const [residu, setResidu] = useState(
    awal && awal.residu > 0 ? awal.residu.toLocaleString("id-ID") : "",
  );
  const [lokasi, setLokasi] = useState(awal?.lokasi ?? "");
  const [catatan, setCatatan] = useState(awal?.catatan ?? "");

  const masukan: MasukanAset = {
    kode,
    nama,
    kategori,
    unitKode,
    tanggal,
    nilaiPerolehan: keAngka(nilai),
    masaManfaat: Number(masaManfaat) || 0,
    residu: keAngka(residu),
    lokasi,
    catatan,
  };
  const salah = periksaAset(masukan);

  const isian =
    "h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40";
  const label = "text-[13px] leading-[18px] font-semibold";

  const pil = (aktif: boolean, teks: string, saatKlik: () => void) => (
    <button
      key={teks}
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
      {teks}
    </button>
  );

  return (
    <>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label htmlFor="kode-aset" className={label}>
              Kode
            </label>
            <input
              id="kode-aset"
              value={kode}
              maxLength={12}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setKode(e.target.value.toUpperCase())}
              placeholder={kodeBerikutnya ?? "AST-0001"}
              className={cn(isian, "font-mono")}
            />
            {!awal && kodeBerikutnya ? (
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                Dikosongkan berarti {kodeBerikutnya}.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="tanggal-aset" className={label}>
              Diperoleh
            </label>
            <input
              id="tanggal-aset"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className={isian}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="nama-aset" className={label}>
            Nama barang
          </label>
          <input
            id="nama-aset"
            value={nama}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => setNama(e.target.value)}
            placeholder="Mis. Laptop editor MacBook Pro 14"
            className={isian}
          />
        </div>

        <fieldset className="space-y-1.5">
          <legend className={label}>Kategori</legend>
          <div className="flex flex-wrap gap-1">
            {KATEGORI.map((k) => pil(kategori === k, k, () => setKategori(k)))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className={label}>Unit</legend>
          <div className="flex flex-wrap gap-1">
            {pil(unitKode === null, "Perusahaan", () => setUnitKode(null))}
            {pilihan.unit.map((u) =>
              pil(unitKode === u.kode, u.nama, () => setUnitKode(u.kode)),
            )}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label htmlFor="nilai-aset" className={label}>
              Nilai perolehan
            </label>
            <input
              id="nilai-aset"
              inputMode="numeric"
              value={nilai}
              onChange={(e) =>
                setNilai(keAngka(e.target.value).toLocaleString("id-ID"))
              }
              placeholder="0"
              className={cn(isian, "tabular")}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="residu-aset" className={label}>
              Nilai residu
            </label>
            <input
              id="residu-aset"
              inputMode="numeric"
              value={residu}
              onChange={(e) =>
                setResidu(keAngka(e.target.value).toLocaleString("id-ID"))
              }
              placeholder="0"
              className={cn(isian, "tabular")}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="masa-aset" className={label}>
            Masa manfaat (bulan)
          </label>
          <input
            id="masa-aset"
            inputMode="numeric"
            value={masaManfaat}
            onChange={(e) =>
              setMasaManfaat(e.target.value.replace(/[^\d]/g, ""))
            }
            placeholder="48"
            className={cn(isian, "tabular")}
          />
          <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
            0 berarti tidak disusutkan. Sisanya menyusut garis lurus sampai
            tinggal nilai residu.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="lokasi-aset-form" className={label}>
            Lokasi
          </label>
          <input
            id="lokasi-aset-form"
            value={lokasi}
            maxLength={60}
            autoComplete="off"
            onChange={(e) => setLokasi(e.target.value)}
            placeholder="Mis. Studio MCN Lt. 2"
            className={isian}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="catatan-aset-form" className={label}>
            Catatan{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </label>
          <input
            id="catatan-aset-form"
            value={catatan}
            maxLength={200}
            autoComplete="off"
            onChange={(e) => setCatatan(e.target.value)}
            className="h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        {salah && (nama !== "" || nilai !== "") ? (
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
          {awal ? "Simpan perubahan" : "Catat aset"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Mencatat aset baru — untuk barang di luar pembelian yang tercatat. */
export function DialogTambahAset({
  pilihan,
  kodeBerikutnya,
  tanggalBawaan,
}: {
  pilihan: PilihanOrganisasi;
  kodeBerikutnya: string;
  /** Tanggal acuan aplikasi — di mode demo bukan hari ini. */
  tanggalBawaan: string;
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
          Catat aset
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat aset</DialogTitle>
          <DialogDescription>
            Pembelian yang lewat transaksi berjenis aset dicatat otomatis; jalur
            ini untuk barang lama atau perolehan di luar pembelian.
          </DialogDescription>
        </DialogHeader>

        <Isian
          pilihan={pilihan}
          kodeBerikutnya={kodeBerikutnya}
          tanggalBawaan={tanggalBawaan}
          menyimpan={menyimpan}
          pesan={pesan}
          onSimpan={(data) =>
            mulai(async () => {
              setPesan(null);
              const hasil = await tambahAset(data);
              setPesan(hasil.pesan ?? null);
              if (hasil.ok) setBuka(false);
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/** Membetulkan data aset yang sudah tercatat. */
export function DialogUbahAset({
  aset,
  pilihan,
}: {
  aset: Aset;
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
          variant="outline"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <Pencil className="size-3.5" />
          Ubah data
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah {aset.kode}</DialogTitle>
          <DialogDescription>
            Keadaan dan pemegangnya diubah lewat pencatatan perpindahan.
            Perubahan nilai dan masa manfaat meninggalkan jejak.
          </DialogDescription>
        </DialogHeader>

        <Isian
          awal={aset}
          pilihan={pilihan}
          kodeBerikutnya={null}
          tanggalBawaan={aset.tanggal}
          menyimpan={menyimpan}
          pesan={pesan}
          onSimpan={(data) =>
            mulai(async () => {
              setPesan(null);
              const hasil = await ubahAset(aset.id, data);
              setPesan(hasil.pesan ?? null);
              if (hasil.ok) setBuka(false);
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
