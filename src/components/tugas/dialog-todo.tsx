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
import { tambahToDo } from "@/app/actions/tugas";
import type { Prioritas } from "@/lib/types";

const PRIORITAS: { nilai: Prioritas; label: string }[] = [
  { nilai: "tinggi", label: "Tinggi" },
  { nilai: "sedang", label: "Sedang" },
  { nilai: "rendah", label: "Rendah" },
];

/**
 * Tambah to-do pribadi. Sengaja ringkas — judul dan tanggal sudah cukup
 * untuk mencatat cepat di tengah kerja; sisanya opsional.
 *
 * Tanggal wajib (D3) supaya to-do selalu masuk papan tanggal tertentu;
 * tanpa jam, ia berlaku sampai akhir hari itu. Target (mis. 14 sesi)
 * opsional — versi ringan SMART untuk to-do (D5).
 */
export function DialogToDo({
  hariIni,
  tanggalAwal,
}: {
  /** Hari ini (WIB) — tanggal paling awal yang boleh dipilih. */
  hariIni: string;
  /** Tanggal bawaan isian; tidak pernah sebelum hari ini. */
  tanggalAwal: string;
}) {
  const [buka, setBuka] = useState(false);
  const [judul, setJudul] = useState("");
  const [konteks, setKonteks] = useState("");
  const [tanggal, setTanggal] = useState(tanggalAwal);
  const [jam, setJam] = useState("");
  const [targetAngka, setTargetAngka] = useState("");
  const [targetSatuan, setTargetSatuan] = useState("");
  const [prioritas, setPrioritas] = useState<Prioritas>("sedang");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const siap = judul.trim().length >= 3 && tanggal !== "";

  const bukaTutup = (b: boolean) => {
    // Setiap kali dibuka, tanggal kembali ke bawaan halaman — bisa saja
    // tanggal papan sudah berganti sejak isian terakhir.
    if (b) setTanggal(tanggalAwal);
    setBuka(b);
  };

  const simpan = () => {
    if (!siap || menyimpan) return;
    setPesan(null);

    mulai(async () => {
      const hasil = await tambahToDo({
        judul,
        konteks,
        tanggal,
        jam: jam || null,
        targetAngka,
        targetSatuan,
        prioritas,
      });

      if (hasil.ok || hasil.kode === "demo") {
        setJudul("");
        setKonteks("");
        setJam("");
        setTargetAngka("");
        setTargetSatuan("");
        setBuka(false);
        if (!hasil.ok) setPesan(hasil.pesan);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={bukaTutup}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <Plus className="size-3.5" />
          Tambah to-do
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah to-do pribadi</DialogTitle>
          <DialogDescription>
            Hanya kamu yang melihatnya. Untuk menugasi orang lain, buat tiket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="judul-todo"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Yang mau dikerjakan
            </label>
            <input
              id="judul-todo"
              value={judul}
              maxLength={200}
              autoComplete="off"
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Mis. cek 14 sesi live sore"
              className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="konteks-todo"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Konteks{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </label>
            <input
              id="konteks-todo"
              value={konteks}
              maxLength={120}
              autoComplete="off"
              onChange={(e) => setKonteks(e.target.value)}
              placeholder="Mis. Affiliator · jadwal 16.00–21.00"
              className="h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="tanggal-todo"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Tanggal
              </label>
              <input
                id="tanggal-todo"
                type="date"
                required
                min={hariIni}
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="jam-todo"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Jam{" "}
                <span className="font-normal text-muted-foreground">
                  (opsional)
                </span>
              </label>
              <input
                id="jam-todo"
                type="time"
                value={jam}
                onChange={(e) => setJam(e.target.value)}
                className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>
          <p className="-mt-1.5 text-[11px] leading-[14px] text-muted-foreground">
            Tanpa jam, to-do berlaku sampai akhir hari itu.
          </p>

          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Target{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </legend>
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={targetAngka}
                onChange={(e) => setTargetAngka(e.target.value)}
                placeholder="14"
                aria-label="Angka target"
                className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <input
                value={targetSatuan}
                maxLength={40}
                autoComplete="off"
                onChange={(e) => setTargetSatuan(e.target.value)}
                placeholder="Satuan, mis. sesi"
                aria-label="Satuan target"
                className="h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </fieldset>

          <div>
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] leading-[18px] font-semibold">
                Prioritas
              </legend>
              <div className="flex gap-1">
                {PRIORITAS.map((p) => (
                  <button
                    key={p.nilai}
                    type="button"
                    onClick={() => setPrioritas(p.nilai)}
                    aria-pressed={p.nilai === prioritas}
                    className={cn(
                      "tekan-halus h-11 flex-1 rounded-xl text-[11px] font-semibold",
                      p.nilai === prioritas
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </fieldset>
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
            {menyimpan ? "Menyimpan…" : "Simpan to-do"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
