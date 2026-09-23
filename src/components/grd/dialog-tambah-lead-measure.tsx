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
import { MAKS_LEAD_MEASURE } from "@/lib/goal";
import { tambahLeadMeasure } from "@/app/actions/lead-measure";

export type PilihanGoalLead = {
  id: string;
  judul: string;
  /** Lead measure aktif yang sudah menempel pada goal ini. */
  jumlahAktif: number;
};

/**
 * Menyusun langkah kunci baru untuk sebuah goal.
 *
 * PRD membatasi tiga lead measure aktif per goal; batasnya tetap dijaga
 * database, tetapi goal yang sudah penuh ditandai dan dimatikan di sini
 * juga — penolakan yang bisa diperkirakan tidak perlu menunggu kiriman.
 */
export function DialogTambahLeadMeasure({ goal }: { goal: PilihanGoalLead[] }) {
  const [buka, setBuka] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(
    goal.find((g) => g.jumlahAktif < MAKS_LEAD_MEASURE)?.id ?? null,
  );
  const [judul, setJudul] = useState("");
  const [satuan, setSatuan] = useState("");
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const angka = Number(target.replace(",", "."));
  const siap =
    goalId !== null &&
    judul.trim().length >= 3 &&
    Number.isFinite(angka) &&
    angka > 0;

  const simpan = () => {
    if (!siap || menyimpan || !goalId) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await tambahLeadMeasure({
        goalId,
        judul: judul.trim(),
        satuan: satuan.trim() || "unit",
        targetMingguan: angka,
        labelPendukung: label.trim() || null,
      });

      if (hasil.ok || hasil.kode === "demo") {
        setJudul("");
        setSatuan("");
        setTarget("");
        setLabel("");
        setBuka(false);
        if (!hasil.ok) setPesan(hasil.pesan);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  const isian =
    "h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40";

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <Plus className="size-3.5" />
          Tambah lead measure
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lead measure baru</DialogTitle>
          <DialogDescription>
            Langkah kunci yang bisa dikendalikan tim dan dicatat setiap hari.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Goal
            </legend>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {goal.map((g) => {
                // Goal yang sudah penuh dimatikan di sini, bukan dibiarkan
                // dipilih lalu ditolak database: penolakan yang bisa
                // diperkirakan sebaiknya terlihat sebelum orangnya
                // mengetik judul dan target.
                const penuh = g.jumlahAktif >= MAKS_LEAD_MEASURE;
                return (
                  <button
                    key={g.id}
                    type="button"
                    disabled={penuh}
                    onClick={() => setGoalId(g.id)}
                    aria-pressed={g.id === goalId}
                    className={cn(
                      "baris-interaktif flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13px] leading-[18px] font-medium",
                      penuh
                        ? "cursor-not-allowed bg-muted/30 text-muted-foreground"
                        : g.id === goalId
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "bg-muted/50",
                    )}
                  >
                    <span className="min-w-0 truncate">{g.judul}</span>
                    <span
                      className={cn(
                        "tabular shrink-0 rounded-full px-1.5 text-[10px] leading-[16px] font-semibold",
                        penuh
                          ? "bg-warn-fill text-warn-text"
                          : "bg-card text-muted-foreground",
                      )}
                    >
                      {g.jumlahAktif}/{MAKS_LEAD_MEASURE}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              Maksimal {MAKS_LEAD_MEASURE} lead measure aktif per goal; yang
              sudah penuh tidak bisa dipilih.
            </p>
          </fieldset>

          <div className="space-y-1.5">
            <label
              htmlFor="judul-lead"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Judul
            </label>
            <input
              id="judul-lead"
              value={judul}
              maxLength={120}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Creator Binding MMC"
              className={isian}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="satuan-lead"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Satuan
              </label>
              <input
                id="satuan-lead"
                value={satuan}
                maxLength={20}
                onChange={(e) => setSatuan(e.target.value)}
                placeholder="akun"
                className={isian}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="target-lead"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Target per pekan
              </label>
              <input
                id="target-lead"
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="15"
                className={cn(isian, "tabular-nums")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="label-lead"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Angka pendukung{" "}
              <span className="font-normal text-muted-foreground">
                (boleh kosong)
              </span>
            </label>
            <input
              id="label-lead"
              value={label}
              maxLength={60}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Peserta hadir MMC"
              className={isian}
            />
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              Diisi bila tiap entri punya angka pendamping, mis. peserta yang
              hadir pada acara MMC.
            </p>
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
            {menyimpan ? "Menyimpan…" : "Simpan lead measure"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
