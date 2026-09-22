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
import { rupiahRingkas } from "@/lib/format";
import { catatTransaksi, ubahTransaksi } from "@/app/actions/keuangan";
import {
  LABEL_JENIS_KELUAR,
  penyetujuiWajib,
  periksaTransaksi,
  type ArahTransaksi,
  type JenisKeluar,
  type Transaksi,
} from "@/lib/keuangan";
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

/**
 * Formulir catat transaksi — dipakai juga untuk membetulkan pengajuan
 * yang belum diputuskan (`awal`).
 *
 * Arah dipilih paling dulu karena ia menentukan sisanya: pengeluaran
 * wajib berjenis, pemasukan wajib menyebut unit pendapatannya. Siapa yang
 * harus menyetujui ditampilkan sebelum menyimpan — bukan kejutan setelah.
 */
export function DialogTransaksi({
  pilihan,
  saldoKas,
  tanggalBawaan,
  awal = null,
  buka: bukaLuar,
  onBuka,
}: {
  pilihan: PilihanOrganisasi;
  saldoKas: number;
  tanggalBawaan: string;
  /** Transaksi yang sedang dibetulkan; kosong berarti mencatat baru. */
  awal?: Transaksi | null;
  /** Kendali dari luar, untuk tombol ubah di daftar transaksi. */
  buka?: boolean;
  onBuka?: (buka: boolean) => void;
}) {
  const [bukaDalam, setBukaDalam] = useState(false);
  const buka = bukaLuar ?? bukaDalam;
  const setBuka = onBuka ?? setBukaDalam;
  const [arah, setArah] = useState<ArahTransaksi>(awal?.arah ?? "keluar");
  const [jenis, setJenis] = useState<JenisKeluar | null>(
    awal ? awal.jenis : "beban",
  );
  const [unitKode, setUnitKode] = useState<KodeUnit | null>(
    awal?.unitKode ?? null,
  );
  const [akun, setAkun] = useState<string | null>(awal?.akunUsername ?? null);
  const [tanggal, setTanggal] = useState(awal?.tanggal ?? tanggalBawaan);
  const [keterangan, setKeterangan] = useState(awal?.keterangan ?? "");
  const [jumlah, setJumlah] = useState(
    awal ? awal.jumlah.toLocaleString("id-ID") : "",
  );
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const masukan = {
    tanggal,
    arah,
    jenis: arah === "keluar" ? jenis : null,
    unitKode,
    akunUsername: akun,
    keterangan,
    jumlah: keAngka(jumlah),
  };
  const salah = periksaTransaksi(masukan);
  const penyetuju = penyetujuiWajib(saldoKas);

  const simpan = () => {
    if (salah || menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = awal
        ? await ubahTransaksi(awal.id, masukan)
        : await catatTransaksi(masukan);
      setPesan(hasil.pesan ?? null);
      if (hasil.ok && !awal) {
        setKeterangan("");
        setJumlah("");
      }
    });
  };

  const isian =
    "h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40";

  const pil = (
    aktif: boolean,
    label: string,
    saatKlik: () => void,
    kunci: string,
  ) => (
    <button
      key={kunci}
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

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      {bukaLuar === undefined ? (
        <DialogTrigger asChild>
          <Button
            type="button"
            className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
          >
            <Plus className="size-3.5" />
            Catat transaksi
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {awal ? `Betulkan ${awal.keterangan}` : "Catat transaksi"}
          </DialogTitle>
          <DialogDescription>
            {awal
              ? "Pengajuan yang belum diputuskan masih bisa dibetulkan; setelah diputuskan, isinya terkunci."
              : `Pengeluaran menunggu persetujuan ${penyetuju}; kas sekarang ${rupiahRingkas(saldoKas)}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Arah
            </legend>
            <div className="flex gap-1">
              {pil(
                arah === "keluar",
                "Uang keluar",
                () => {
                  setArah("keluar");
                  setJenis("beban");
                },
                "arah-keluar",
              )}
              {pil(
                arah === "masuk",
                "Uang masuk",
                () => {
                  setArah("masuk");
                  setJenis(null);
                },
                "arah-masuk",
              )}
            </div>
          </fieldset>

          {arah === "keluar" ? (
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] leading-[18px] font-semibold">
                Jenis pengeluaran
              </legend>
              <div className="flex flex-wrap gap-1">
                {JENIS.map((j) =>
                  pil(jenis === j, LABEL_JENIS_KELUAR[j], () => setJenis(j), j),
                )}
              </div>
              <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                {jenis === "aset"
                  ? "Aset tidak mengurangi laba — barangnya tetap milik perusahaan — tetapi kas berkurang."
                  : "Beban mengurangi laba; direct cost dan creator share mengurangi net revenue."}
              </p>
            </fieldset>
          ) : null}

          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Unit{" "}
              {arah === "masuk" ? null : (
                <span className="font-normal text-muted-foreground">
                  (boleh kosong)
                </span>
              )}
            </legend>
            <div className="flex flex-wrap gap-1">
              {pilihan.unit.map((u) =>
                pil(
                  unitKode === u.kode,
                  u.nama,
                  () => setUnitKode(unitKode === u.kode ? null : u.kode),
                  `unit-${u.kode}`,
                ),
              )}
            </div>
          </fieldset>

          {unitKode ? (
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] leading-[18px] font-semibold">
                Akun{" "}
                <span className="font-normal text-muted-foreground">
                  (boleh kosong)
                </span>
              </legend>
              <div className="flex flex-wrap gap-1">
                {pilihan.akun
                  .filter((a) => a.unitKode === unitKode)
                  .map((a) =>
                    pil(
                      akun === a.username,
                      a.username,
                      () => setAkun(akun === a.username ? null : a.username),
                      `akun-${a.id}`,
                    ),
                  )}
              </div>
            </fieldset>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="tanggal-transaksi"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Tanggal
              </label>
              <input
                id="tanggal-transaksi"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={isian}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="jumlah-transaksi"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Nominal
              </label>
              <input
                id="jumlah-transaksi"
                inputMode="numeric"
                value={
                  keAngka(jumlah) === 0
                    ? ""
                    : keAngka(jumlah).toLocaleString("id-ID")
                }
                onChange={(e) => setJumlah(e.target.value)}
                placeholder="0"
                className={cn(isian, "tabular-nums")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="keterangan-transaksi"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Keterangan
            </label>
            <textarea
              id="keterangan-transaksi"
              value={keterangan}
              rows={2}
              maxLength={200}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Mis. Iklan TikTok akun skincare pekan ke-3"
              className="w-full rounded-xl bg-muted px-4 py-2.5 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          {salah && (keterangan !== "" || jumlah !== "") ? (
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
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            {awal
              ? "Simpan perubahan"
              : arah === "masuk"
                ? "Catat pemasukan"
                : "Ajukan pengeluaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
