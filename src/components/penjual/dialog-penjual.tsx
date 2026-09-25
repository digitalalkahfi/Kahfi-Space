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
  ARTI_STATUS_PENJUAL,
  GAYA_STATUS_PENJUAL,
  LABEL_STATUS_PENJUAL,
  STATUS_PENJUAL_SAH,
  komisiDariTeks,
  type Penjual,
  type StatusPenjual,
} from "@/lib/penjual";
import {
  tambahPenjual,
  ubahPenjual,
  type MasukanPenjual,
} from "@/app/actions/penjual";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

export type CalonPic = { id: string; nama: string; unitId: KodeUnit | null };

type PropsForm = {
  pilihan: PilihanOrganisasi;
  anggota: CalonPic[];
  /** Leader/Co-Leader hanya boleh untuk unitnya sendiri. */
  unitTerkunci: KodeUnit | null;
  awal?: Penjual;
  unitBawaan: KodeUnit | null;
  onSelesai: (pesan: string | null) => void;
};

const KELAS_INPUT =
  "h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40";
const KELAS_LABEL = "text-[13px] leading-[18px] font-semibold";

/**
 * Formulir mitra, dipakai dialog tambah maupun ubah.
 *
 * Komisi diketik bebas ("17", "10%") dan dibakukan ke persen di sini:
 * itulah cara orang menuliskannya di sistem lama, dan memaksa angka
 * murni hanya menambah satu alasan formulirnya tidak diisi.
 */
function FormPenjual({
  pilihan,
  anggota,
  unitTerkunci,
  awal,
  unitBawaan,
  onSelesai,
}: PropsForm) {
  const [namaToko, setNamaToko] = useState(awal?.namaToko ?? "");
  const [namaKontak, setNamaKontak] = useState(awal?.namaKontak ?? "");
  const [telepon, setTelepon] = useState(awal?.telepon ?? "");
  const [kategori, setKategori] = useState(awal?.kategori ?? "");
  const [status, setStatus] = useState<StatusPenjual>(
    awal?.status ?? "prospek",
  );
  const [komisi, setKomisi] = useState(
    awal?.komisiPersen === null || awal?.komisiPersen === undefined
      ? ""
      : String(awal.komisiPersen),
  );
  const [catatan, setCatatan] = useState(awal?.catatan ?? "");
  const [unitKode, setUnitKode] = useState<KodeUnit>(
    awal?.unitKode ?? unitTerkunci ?? unitBawaan ?? "tap",
  );
  const [picId, setPicId] = useState<string>(awal?.picId ?? "");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const komisiSah = komisi.trim() === "" || komisiDariTeks(komisi) !== null;
  const siap = namaToko.trim().length >= 2 && komisiSah && !menyimpan;
  const calonPic = anggota.filter((a) => a.unitId === unitKode);

  const simpan = () => {
    if (!siap) return;
    const input: MasukanPenjual = {
      namaToko,
      namaKontak,
      telepon,
      kategori,
      status,
      komisiPersen: komisiDariTeks(komisi),
      catatan,
      unitKode,
      picUserId: picId || null,
    };
    mulai(async () => {
      setPesan(null);
      const hasil = awal
        ? await ubahPenjual(awal.id, input)
        : await tambahPenjual(input);
      if (hasil.ok || hasil.kode === "demo") {
        onSelesai(hasil.ok ? null : (hasil.pesan ?? null));
        return;
      }
      setPesan(hasil.pesan ?? null);
    });
  };

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="toko-penjual" className={KELAS_LABEL}>
            Nama toko atau brand
          </label>
          <input
            id="toko-penjual"
            value={namaToko}
            maxLength={120}
            autoComplete="off"
            onChange={(e) => setNamaToko(e.target.value)}
            placeholder="Mis. Torch.id"
            className={KELAS_INPUT}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="kontak-penjual" className={KELAS_LABEL}>
              Nama kontak{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </label>
            <input
              id="kontak-penjual"
              value={namaKontak}
              maxLength={80}
              autoComplete="off"
              onChange={(e) => setNamaKontak(e.target.value)}
              placeholder="Orang yang dihubungi"
              className={KELAS_INPUT}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="telepon-penjual" className={KELAS_LABEL}>
              Telepon / WhatsApp{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </label>
            <input
              id="telepon-penjual"
              value={telepon}
              maxLength={40}
              inputMode="tel"
              autoComplete="off"
              onChange={(e) => setTelepon(e.target.value)}
              placeholder="0812-3456-7890"
              className={KELAS_INPUT}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="kategori-penjual" className={KELAS_LABEL}>
              Kategori{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </label>
            <input
              id="kategori-penjual"
              value={kategori}
              maxLength={60}
              autoComplete="off"
              onChange={(e) => setKategori(e.target.value)}
              placeholder="Fashion, Beauty, Otomotif…"
              className={KELAS_INPUT}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="komisi-penjual" className={KELAS_LABEL}>
              Komisi (%){" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </label>
            <input
              id="komisi-penjual"
              value={komisi}
              maxLength={6}
              inputMode="decimal"
              autoComplete="off"
              onChange={(e) => setKomisi(e.target.value)}
              placeholder="Mis. 12"
              aria-invalid={!komisiSah}
              className={cn(KELAS_INPUT, !komisiSah && "ring-2 ring-warn/60")}
            />
            {!komisiSah ? (
              <p className="text-[11px] leading-[14px] text-warn-text">
                Tulis angka antara 0 dan 100.
              </p>
            ) : null}
          </div>
        </div>

        <fieldset className="space-y-1.5">
          <legend className={KELAS_LABEL}>Status</legend>
          <div className="flex flex-wrap gap-1">
            {STATUS_PENJUAL_SAH.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={s === status}
                className={cn(
                  "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                  s === status
                    ? "bg-primary text-primary-foreground"
                    : GAYA_STATUS_PENJUAL[s].kelas,
                )}
              >
                {LABEL_STATUS_PENJUAL[s]}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            {ARTI_STATUS_PENJUAL[status]}
          </p>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className={KELAS_LABEL}>Unit yang menggarap</legend>
          <div className="flex flex-wrap gap-1">
            {pilihan.unit.map((u) => {
              const terkunci = unitTerkunci !== null && u.kode !== unitTerkunci;
              return (
                <button
                  key={u.kode}
                  type="button"
                  disabled={terkunci}
                  onClick={() => {
                    setUnitKode(u.kode);
                    setPicId("");
                  }}
                  aria-pressed={u.kode === unitKode}
                  className={cn(
                    "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold disabled:opacity-40",
                    u.kode === unitKode
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {u.nama}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="pic-penjual" className={KELAS_LABEL}>
            PIC{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </label>
          <select
            id="pic-penjual"
            value={picId}
            onChange={(e) => setPicId(e.target.value)}
            className={cn(KELAS_INPUT, "appearance-none")}
          >
            <option value="">Belum ada PIC</option>
            {calonPic.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nama}
              </option>
            ))}
          </select>
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Anggota unit ini yang menjadi penghubung mitra. PIC boleh
            memperbarui catatan dan status mitranya sendiri.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="catatan-penjual" className={KELAS_LABEL}>
            Catatan{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </label>
          <textarea
            id="catatan-penjual"
            value={catatan}
            maxLength={1000}
            rows={3}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Kesepakatan, tindak lanjut, atau kendala"
            className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
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
          disabled={!siap}
          onClick={simpan}
          className="tekan-halus rounded-full"
        >
          {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
          {menyimpan ? "Menyimpan…" : awal ? "Simpan perubahan" : "Tambahkan"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function DialogTambahPenjual({
  pilihan,
  anggota,
  unitTerkunci,
  unitBawaan,
}: {
  pilihan: PilihanOrganisasi;
  anggota: CalonPic[];
  unitTerkunci: KodeUnit | null;
  unitBawaan: KodeUnit | null;
}) {
  const [buka, setBuka] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogTrigger asChild>
          <Button
            type="button"
            className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
          >
            <Plus className="size-3.5" />
            Tambah mitra
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah mitra</DialogTitle>
            <DialogDescription>
              Catat toko atau brand yang sedang dijajaki. Statusnya bisa
              diperbarui kapan saja begitu kesepakatannya jalan.
            </DialogDescription>
          </DialogHeader>
          {buka ? (
            <FormPenjual
              pilihan={pilihan}
              anggota={anggota}
              unitTerkunci={unitTerkunci}
              unitBawaan={unitBawaan}
              onSelesai={(p) => {
                setPesan(p);
                setBuka(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      {pesan ? (
        <p
          role="status"
          className="rounded-xl bg-muted px-3 py-2 text-[11px] leading-[14px] text-muted-foreground"
        >
          {pesan}
        </p>
      ) : null}
    </div>
  );
}

export function DialogUbahPenjual({
  penjual,
  pilihan,
  anggota,
  unitTerkunci,
  buka,
  onBuka,
}: {
  penjual: Penjual;
  pilihan: PilihanOrganisasi;
  anggota: CalonPic[];
  unitTerkunci: KodeUnit | null;
  buka: boolean;
  onBuka: (b: boolean) => void;
}) {
  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ubah {penjual.namaToko}</DialogTitle>
          <DialogDescription>
            Perubahan langsung terlihat oleh seluruh anggota unit.
          </DialogDescription>
        </DialogHeader>
        {buka ? (
          <FormPenjual
            pilihan={pilihan}
            anggota={anggota}
            unitTerkunci={unitTerkunci}
            unitBawaan={penjual.unitKode}
            awal={penjual}
            onSelesai={() => onBuka(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
