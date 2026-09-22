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
  GAYA_JENIS_AGENDA,
  LABEL_JENIS_AGENDA,
  type JenisAgenda,
} from "@/lib/kalender";
import { tambahAgenda } from "@/app/actions/kalender";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

const JENIS: JenisAgenda[] = ["rapat", "pelatihan", "libur", "lainnya"];

/**
 * Tambah agenda ke kalender bersama.
 *
 * Tidak ada pilihan "tenggat" di sini: tenggat tugas ditarik dari modul
 * Tugas dan tidak boleh diketik ulang — dua tanggal untuk satu hal yang
 * sama akan cepat berbeda.
 */
export function DialogTambahAgenda({
  pilihan,
  tanggalBawaan,
  unitTerkunci,
}: {
  pilihan: PilihanOrganisasi;
  tanggalBawaan: string;
  /** Diisi untuk Leader: ia hanya boleh mengatur unitnya sendiri. */
  unitTerkunci: KodeUnit | null;
}) {
  const [buka, setBuka] = useState(false);
  const [judul, setJudul] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [jenis, setJenis] = useState<JenisAgenda>("rapat");
  const [tanggal, setTanggal] = useState(tanggalBawaan);
  const [jamMulai, setJamMulai] = useState("");
  const [jamSelesai, setJamSelesai] = useState("");
  const [unitKode, setUnitKode] = useState<KodeUnit | null>(unitTerkunci);
  const [lokasi, setLokasi] = useState("");
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
      const hasil = await tambahAgenda({
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
        setJudul("");
        setKeterangan("");
        setLokasi("");
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
          Tambah agenda
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah agenda</DialogTitle>
          <DialogDescription>
            Untuk rapat, libur, dan pelatihan. Tenggat tugas sudah muncul
            sendiri dari modul Tugas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="judul-agenda"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Judul
            </label>
            <input
              id="judul-agenda"
              value={judul}
              maxLength={140}
              autoComplete="off"
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Mis. Rapat mingguan WRM"
              className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
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
              htmlFor="tanggal-agenda"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Tanggal
            </label>
            <input
              id="tanggal-agenda"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label
                htmlFor="mulai-agenda"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Jam mulai{" "}
                <span className="font-normal text-muted-foreground">
                  (opsional)
                </span>
              </label>
              <input
                id="mulai-agenda"
                type="time"
                value={jamMulai}
                onChange={(e) => setJamMulai(e.target.value)}
                className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label
                htmlFor="selesai-agenda"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Jam selesai
              </label>
              <input
                id="selesai-agenda"
                type="time"
                value={jamSelesai}
                onChange={(e) => setJamSelesai(e.target.value)}
                className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Kosongkan keduanya untuk agenda sepanjang hari.
          </p>

          {unitTerkunci === null ? (
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] leading-[18px] font-semibold">
                Untuk unit{" "}
                <span className="font-normal text-muted-foreground">
                  (kosongkan bila seluruh perusahaan)
                </span>
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
          ) : (
            <p className="rounded-xl bg-muted px-3 py-2 text-[11px] leading-[14px] text-pretty text-muted-foreground">
              Agenda ini dibuat untuk unitmu sendiri. Untuk agenda seluruh
              perusahaan, mintalah Manager yang membuatnya.
            </p>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="lokasi-agenda"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Lokasi{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </label>
            <input
              id="lokasi-agenda"
              value={lokasi}
              maxLength={120}
              autoComplete="off"
              onChange={(e) => setLokasi(e.target.value)}
              placeholder="Mis. Ruang rapat lantai 2"
              className="h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="keterangan-agenda"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Keterangan{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </label>
            <textarea
              id="keterangan-agenda"
              value={keterangan}
              maxLength={500}
              rows={2}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Apa yang dibahas atau perlu disiapkan"
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
            disabled={!siap || menyimpan}
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            Simpan agenda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
