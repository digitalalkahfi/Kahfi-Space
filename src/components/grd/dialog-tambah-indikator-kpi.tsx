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
import { tambahIndikatorKpi } from "@/app/actions/kpi";
import { LABEL_SUMBER, type SumberKpi } from "@/lib/kpi";

const SUMBER: SumberKpi[] = [
  "gmv",
  "lead_measure",
  "absensi",
  "tiket",
  "manual",
];

/**
 * Menambah indikator KPI untuk satu jabatan.
 *
 * Total bobot jabatan itu ditampilkan lebih dulu, supaya jelas berapa sisa
 * bobot yang masih bisa dibagikan sebelum penilaian jadi timpang.
 */
export function DialogTambahIndikatorKpi({
  jabatan,
}: {
  jabatan: { nama: string; totalBobot: number }[];
}) {
  const [buka, setBuka] = useState(false);
  const [pilihJabatan, setPilihJabatan] = useState(jabatan[0]?.nama ?? "");
  const [nama, setNama] = useState("");
  const [bobot, setBobot] = useState("");
  const [satuan, setSatuan] = useState("");
  const [sumber, setSumber] = useState<SumberKpi>("manual");
  const [base, setBase] = useState("");
  const [target, setTarget] = useState("");
  const [stretch, setStretch] = useState("");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const angka = (teks: string) =>
    Number(teks.replace(/\./g, "").replace(",", "."));
  const nBobot = angka(bobot);
  const nBase = angka(base);
  const nGoal = angka(target);
  const nStretch = angka(stretch);

  const terpilih = jabatan.find((j) => j.nama === pilihJabatan);
  const sisaBobot = terpilih ? 100 - terpilih.totalBobot : 100;

  const siap =
    pilihJabatan !== "" &&
    nama.trim().length >= 3 &&
    Number.isFinite(nBobot) &&
    nBobot > 0 &&
    nBobot <= 100 &&
    [nBase, nGoal, nStretch].every(Number.isFinite) &&
    base !== "" &&
    target !== "" &&
    stretch !== "" &&
    nBase <= nGoal &&
    nGoal <= nStretch;

  const simpan = () => {
    if (!siap || menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await tambahIndikatorKpi({
        jabatan: pilihJabatan,
        namaKpi: nama.trim(),
        bobot: nBobot,
        satuan: satuan.trim() || "unit",
        targetBase: nBase,
        targetGoal: nGoal,
        targetStretch: nStretch,
        sumberData: sumber,
      });

      if (hasil.ok || hasil.kode === "demo") {
        setNama("");
        setBobot("");
        setBase("");
        setTarget("");
        setStretch("");
        setBuka(false);
        setPesan(hasil.pesan ?? null);
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
          Tambah indikator
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Indikator KPI baru</DialogTitle>
          <DialogDescription>
            Skalanya selalu 1.000: base → 500, goal → 800, stretch → 1.000.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Jabatan
            </legend>
            <div className="flex flex-wrap gap-1">
              {jabatan.map((j) => (
                <button
                  key={j.nama}
                  type="button"
                  onClick={() => setPilihJabatan(j.nama)}
                  aria-pressed={j.nama === pilihJabatan}
                  className={cn(
                    "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                    j.nama === pilihJabatan
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {j.nama}
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              {sisaBobot > 0
                ? `Sisa bobot ${pilihJabatan}: ${sisaBobot.toLocaleString("id-ID")}.`
                : `Bobot ${pilihJabatan} sudah penuh; menambah indikator membuatnya melebihi 100.`}
            </p>
          </fieldset>

          <div className="space-y-1.5">
            <label
              htmlFor="nama-kpi"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Nama indikator
            </label>
            <input
              id="nama-kpi"
              value={nama}
              maxLength={120}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Capaian GMV akun"
              className={isian}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="bobot-kpi"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Bobot
              </label>
              <input
                id="bobot-kpi"
                inputMode="decimal"
                value={bobot}
                onChange={(e) => setBobot(e.target.value)}
                placeholder="25"
                className={cn(isian, "tabular-nums")}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="satuan-kpi"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Satuan
              </label>
              <input
                id="satuan-kpi"
                value={satuan}
                maxLength={20}
                onChange={(e) => setSatuan(e.target.value)}
                placeholder="%"
                className={isian}
              />
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Sumber data
            </legend>
            <div className="flex flex-wrap gap-1">
              {SUMBER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSumber(s)}
                  aria-pressed={s === sumber}
                  className={cn(
                    "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                    s === sumber
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {LABEL_SUMBER[s]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                id: "base-kpi",
                label: "Base → 500",
                nilai: base,
                set: setBase,
              },
              {
                id: "goal-kpi",
                label: "Goal → 800",
                nilai: target,
                set: setTarget,
              },
              {
                id: "stretch-kpi",
                label: "Stretch → 1.000",
                nilai: stretch,
                set: setStretch,
              },
            ].map((x) => (
              <div key={x.id} className="space-y-1.5">
                <label
                  htmlFor={x.id}
                  className="text-[13px] leading-[18px] font-semibold"
                >
                  {x.label}
                </label>
                <input
                  id={x.id}
                  inputMode="decimal"
                  value={x.nilai}
                  onChange={(e) => x.set(e.target.value)}
                  placeholder="0"
                  className={cn(isian, "tabular-nums")}
                />
              </div>
            ))}
          </div>
          {base !== "" && target !== "" && stretch !== "" && !siap ? (
            <p className="text-[11px] leading-[14px] text-warn-text">
              Target harus menanjak: base ≤ goal ≤ stretch.
            </p>
          ) : null}

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
            {menyimpan ? "Menyimpan…" : "Simpan indikator"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
