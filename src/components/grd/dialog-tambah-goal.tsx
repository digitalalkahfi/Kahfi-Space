"use client";

import { useMemo, useState, useTransition } from "react";
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
import { tambahGoal } from "@/app/actions/goal";
import { LEVEL_GOAL, NAMA_LEVEL, anakTangga, bolehJadiInduk } from "@/lib/goal";
import type { LevelGoal } from "@/lib/goal";
import type { PilihanGoal } from "@/lib/data/goal";
import { bulanPendek, rupiahRingkas } from "@/lib/format";

/** Angka berformat Indonesia ("1.162.500.000") menjadi bilangan. */
function keAngka(teks: string) {
  const bersih = teks.replace(/[^\d]/g, "");
  return bersih === "" ? 0 : Number(bersih);
}

function Isian({
  label,
  nilai,
  onUbah,
  petunjuk,
}: {
  label: string;
  nilai: number;
  onUbah: (n: number) => void;
  petunjuk?: string;
}) {
  const id = `goal-${label.toLowerCase().replace(/\s/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[13px] leading-[18px] font-semibold">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={nilai === 0 ? "" : nilai.toLocaleString("id-ID")}
        onChange={(e) => onUbah(keAngka(e.target.value))}
        placeholder="0"
        className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] tabular-nums outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {petunjuk ? (
        <p className="text-[11px] leading-[14px] text-muted-foreground">
          {petunjuk}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Membuat goal baru beserta anak tangga bulanannya.
 *
 * Induk yang ditawarkan hanya goal yang sah menurut tangga roll-down, jadi
 * penolakan database (0065) tidak perlu dialami pemakai lebih dulu.
 */
export function DialogTambahGoal({
  pilihan,
  bulanMulai,
  periode,
}: {
  pilihan: PilihanGoal;
  bulanMulai: string;
  periode: string;
}) {
  const [buka, setBuka] = useState(false);
  const [judul, setJudul] = useState("");
  const [level, setLevel] = useState<LevelGoal>("leader");
  const [pemilikId, setPemilikId] = useState<string | null>(null);
  const [indukId, setIndukId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [akunId, setAkunId] = useState<string | null>(null);
  const [base, setBase] = useState(0);
  const [target, setTarget] = useState(0);
  const [stretch, setStretch] = useState(0);
  const [jumlahBulan, setJumlahBulan] = useState(3);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const unitTerpilih =
    level === "account"
      ? (pilihan.akun.find((a) => a.id === akunId)?.unitId ?? null)
      : unitId;

  const indukSah = useMemo(
    () =>
      pilihan.induk.filter(
        (g) =>
          bolehJadiInduk(level, g.level) &&
          (unitTerpilih === null ||
            g.unitId === null ||
            g.unitId === unitTerpilih),
      ),
    [pilihan.induk, level, unitTerpilih],
  );

  const tangga = target > 0 ? anakTangga(bulanMulai, jumlahBulan, target) : [];

  const siap =
    judul.trim().length >= 3 &&
    pemilikId !== null &&
    base <= target &&
    target <= stretch &&
    target > 0 &&
    (level !== "leader" || unitId !== null) &&
    (level !== "account" || akunId !== null);

  const simpan = () => {
    if (!siap || menyimpan || !pemilikId) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await tambahGoal({
        judul: judul.trim(),
        level,
        pemilikId,
        indukId: indukSah.some((g) => g.id === indukId) ? indukId : null,
        unitId: level === "leader" ? unitId : null,
        akunId: level === "account" ? akunId : null,
        satuan: "IDR",
        targetBase: base,
        targetGoal: target,
        targetStretch: stretch,
        periode,
        mulaiBulan: bulanMulai,
        jumlahBulan,
      });

      if (hasil.ok || hasil.kode === "demo") {
        setJudul("");
        setBase(0);
        setTarget(0);
        setStretch(0);
        setBuka(false);
        if (!hasil.ok) setPesan(hasil.pesan);
        return;
      }
      setPesan(hasil.pesan);
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
          Tambah goal
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Goal baru</DialogTitle>
          <DialogDescription>
            Target tahunan dipecah menjadi anak tangga bulanan begitu goal
            disimpan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="judul-goal"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Judul goal
            </label>
            <input
              id="judul-goal"
              value={judul}
              maxLength={120}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="GMV bulanan unit MCN"
              className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Level
            </legend>
            <div className="flex flex-wrap gap-1">
              {LEVEL_GOAL.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    setLevel(l);
                    setIndukId(null);
                    if (l !== "leader") setUnitId(null);
                    if (l !== "account") setAkunId(null);
                  }}
                  aria-pressed={l === level}
                  className={cn(
                    "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                    l === level
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {NAMA_LEVEL[l]}
                </button>
              ))}
            </div>
          </fieldset>

          {level === "leader" ? (
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] leading-[18px] font-semibold">
                Unit
              </legend>
              <div className="flex flex-wrap gap-1">
                {pilihan.unit.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUnitId(u.id)}
                    aria-pressed={u.id === unitId}
                    className={cn(
                      "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                      u.id === unitId
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {u.nama.split(" (")[0]}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          {level === "account" ? (
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] leading-[18px] font-semibold">
                Akun
              </legend>
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {pilihan.akun.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAkunId(a.id)}
                    aria-pressed={a.id === akunId}
                    className={cn(
                      "baris-interaktif w-full rounded-xl px-3 py-2 text-left text-[13px] leading-[18px] font-medium",
                      a.id === akunId
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "bg-muted/50",
                    )}
                  >
                    {a.username}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Pemilik
            </legend>
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {pilihan.orang.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setPemilikId(o.id)}
                  aria-pressed={o.id === pemilikId}
                  className={cn(
                    "baris-interaktif flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left",
                    o.id === pemilikId
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "bg-muted/50",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] font-medium">
                    {o.nama}
                  </span>
                  <span className="shrink-0 truncate text-[11px] leading-[14px] text-muted-foreground">
                    {o.jabatan}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              Maksimal 3 goal aktif per orang sesuai PRD.
            </p>
          </fieldset>

          {indukSah.length > 0 ? (
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] leading-[18px] font-semibold">
                Induk roll-down{" "}
                <span className="font-normal text-muted-foreground">
                  (boleh kosong)
                </span>
              </legend>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {indukSah.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setIndukId(indukId === g.id ? null : g.id)}
                    aria-pressed={g.id === indukId}
                    className={cn(
                      "baris-interaktif w-full rounded-xl px-3 py-2 text-left text-[13px] leading-[18px] font-medium",
                      g.id === indukId
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "bg-muted/50",
                    )}
                  >
                    {g.judul}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <Isian label="Base" nilai={base} onUbah={setBase} />
            <Isian label="Goal" nilai={target} onUbah={setTarget} />
            <Isian label="Stretch" nilai={stretch} onUbah={setStretch} />
          </div>
          {base > target || target > stretch ? (
            <p className="text-[11px] leading-[14px] text-warn-text">
              Target harus menanjak: base ≤ goal ≤ stretch.
            </p>
          ) : null}

          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Anak tangga
            </legend>
            <div className="flex flex-wrap gap-1">
              {[1, 3, 6, 12].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setJumlahBulan(n)}
                  aria-pressed={n === jumlahBulan}
                  className={cn(
                    "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                    n === jumlahBulan
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n} bulan
                </button>
              ))}
            </div>
            {tangga.length > 0 ? (
              <ul className="space-y-0.5 text-[11px] leading-[14px] text-muted-foreground">
                {tangga.map((t) => (
                  <li key={t.bulan} className="flex justify-between gap-2">
                    <span>{bulanPendek(t.bulan)}</span>
                    <span className="tabular-nums">
                      {rupiahRingkas(t.target)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
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
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            {menyimpan ? "Menyimpan…" : "Simpan goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
