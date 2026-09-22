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
import {
  GAYA_TINGKAT,
  LABEL_TINGKAT,
  type Kursus,
  type TingkatKursus,
} from "@/lib/lms";
import { URUTAN_PERAN } from "@/lib/peran";
import { tambahKursus, ubahKursus } from "@/app/actions/lms";
import type { KodeUnit, Peran, PilihanOrganisasi } from "@/lib/types";

const TINGKAT: TingkatKursus[] = ["dasar", "menengah", "lanjutan"];

type Masukan = {
  judul: string;
  ringkasan: string;
  kategori: string;
  tingkat: TingkatKursus;
  unitKode: KodeUnit | null;
  wajibUntuk: Peran[];
};

function Isian({
  awal,
  pilihan,
  onSimpan,
  menyimpan,
  pesan,
}: {
  awal?: Kursus;
  pilihan: PilihanOrganisasi;
  onSimpan: (data: Masukan) => void;
  menyimpan: boolean;
  pesan: string | null;
}) {
  const [judul, setJudul] = useState(awal?.judul ?? "");
  const [ringkasan, setRingkasan] = useState(awal?.ringkasan ?? "");
  const [kategori, setKategori] = useState(awal?.kategori ?? "Umum");
  const [tingkat, setTingkat] = useState<TingkatKursus>(
    awal?.tingkat ?? "dasar",
  );
  const [unitKode, setUnitKode] = useState<KodeUnit | null>(
    awal?.unitKode ?? null,
  );
  const [wajib, setWajib] = useState<Peran[]>(awal?.wajibUntuk ?? []);

  const siap = judul.trim().length >= 5;

  const alihkanPeran = (p: Peran) =>
    setWajib((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="judul-kursus"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Judul kursus
          </label>
          <input
            id="judul-kursus"
            value={judul}
            maxLength={140}
            autoComplete="off"
            onChange={(e) => setJudul(e.target.value)}
            placeholder="Mis. Dasar Live Streaming TikTok Shop"
            className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="ringkasan-kursus"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Ringkasan
          </label>
          <textarea
            id="ringkasan-kursus"
            value={ringkasan}
            maxLength={400}
            rows={2}
            onChange={(e) => setRingkasan(e.target.value)}
            placeholder="Satu kalimat: setelah kursus ini, orang bisa apa?"
            className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="kategori-kursus"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Kategori
          </label>
          <input
            id="kategori-kursus"
            value={kategori}
            maxLength={60}
            autoComplete="off"
            onChange={(e) => setKategori(e.target.value)}
            placeholder="Mis. Affiliator, GRD, Umum"
            className="h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-[18px] font-semibold">
            Tingkat
          </legend>
          <div className="flex flex-wrap gap-1">
            {TINGKAT.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTingkat(t)}
                aria-pressed={t === tingkat}
                className={cn(
                  "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                  t === tingkat
                    ? "bg-primary text-primary-foreground"
                    : GAYA_TINGKAT[t],
                )}
              >
                {LABEL_TINGKAT[t]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-[18px] font-semibold">
            Unit{" "}
            <span className="font-normal text-muted-foreground">
              (kosongkan bila untuk semua)
            </span>
          </legend>
          <div className="flex flex-wrap gap-1">
            {pilihan.unit.map((u) => (
              <button
                key={u.kode}
                type="button"
                onClick={() => setUnitKode(unitKode === u.kode ? null : u.kode)}
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

        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-[18px] font-semibold">
            Wajib untuk{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </legend>
          <div className="flex flex-wrap gap-1">
            {URUTAN_PERAN.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => alihkanPeran(p)}
                aria-pressed={wajib.includes(p)}
                className={cn(
                  "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                  wajib.includes(p)
                    ? "bg-danger-fill text-danger-text"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
            Peran yang ditandai akan melihat kursus ini sebagai pelatihan wajib
            yang belum tuntas sampai mereka menyelesaikannya.
          </p>
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
          onClick={() =>
            onSimpan({
              judul,
              ringkasan,
              kategori,
              tingkat,
              unitKode,
              wajibUntuk: wajib,
            })
          }
          className="tekan-halus rounded-full"
        >
          {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
          Simpan
        </Button>
      </DialogFooter>
    </>
  );
}

/** Tambah kursus baru. */
export function DialogTambahKursus({
  pilihan,
}: {
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
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <Plus className="size-3.5" />
          Tambah kursus
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah kursus</DialogTitle>
          <DialogDescription>
            Modulnya disusun setelah kursusnya ada.
          </DialogDescription>
        </DialogHeader>

        <Isian
          pilihan={pilihan}
          menyimpan={menyimpan}
          pesan={pesan}
          onSimpan={(data) =>
            mulai(async () => {
              setPesan(null);
              const hasil = await tambahKursus(data);
              if (hasil.ok || hasil.kode === "demo") {
                setBuka(false);
                if (!hasil.ok) setPesan(hasil.pesan ?? null);
                return;
              }
              setPesan(hasil.pesan ?? null);
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/** Ubah keterangan kursus yang sudah ada. */
export function DialogUbahKursus({
  kursus,
  pilihan,
  buka,
  onBuka,
}: {
  kursus: Kursus;
  pilihan: PilihanOrganisasi;
  buka: boolean;
  onBuka: (b: boolean) => void;
}) {
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah kursus</DialogTitle>
          <DialogDescription>
            Mengubah kewajiban langsung mengubah daftar pelatihan wajib orang.
          </DialogDescription>
        </DialogHeader>

        <Isian
          awal={kursus}
          pilihan={pilihan}
          menyimpan={menyimpan}
          pesan={pesan}
          onSimpan={(data) =>
            mulai(async () => {
              setPesan(null);
              const hasil = await ubahKursus(kursus.id, data);
              if (hasil.ok || hasil.kode === "demo") {
                onBuka(false);
                if (!hasil.ok) setPesan(hasil.pesan ?? null);
                return;
              }
              setPesan(hasil.pesan ?? null);
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
