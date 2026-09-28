"use client";

import { useMemo } from "react";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LEVEL_GOAL,
  MAKS_BULAN_GOAL,
  NAMA_LEVEL,
  NAMA_MODE_TARGET,
  akhirPeriode,
  bolehJadiInduk,
  jumlahBulanAntara,
  labelPeriode,
  pilihanBulanMulai,
  susunAnakTangga,
  type LevelGoal,
  type ModeTarget,
} from "@/lib/goal";
import { geserBulan } from "@/lib/kalender";
import type { PilihanGoal } from "@/lib/data/goal";
import { bulanPanjang, bulanPendek, rupiahRingkas } from "@/lib/format";

/** Isi formulir goal — dipakai dialog tambah maupun dialog ubah. */
export type NilaiGoal = {
  judul: string;
  level: LevelGoal;
  pemilikId: string | null;
  indukId: string | null;
  unitId: string | null;
  akunId: string | null;
  base: number;
  target: number;
  stretch: number;
  /** Bulan pertama periode, "YYYY-MM-01". */
  mulai: string;
  jumlahBulan: number;
  mode: ModeTarget;
};

export function nilaiAwalGoal(acuan: string): NilaiGoal {
  return {
    judul: "",
    level: "leader",
    pemilikId: null,
    indukId: null,
    unitId: null,
    akunId: null,
    base: 0,
    target: 0,
    stretch: 0,
    mulai: `${acuan.slice(0, 7)}-01`,
    jumlahBulan: 1,
    mode: "bulanan",
  };
}

/** Semua isian wajib sudah benar. */
export function siapSimpanGoal(n: NilaiGoal) {
  return (
    n.judul.trim().length >= 3 &&
    n.pemilikId !== null &&
    n.target > 0 &&
    n.base <= n.target &&
    n.target <= n.stretch &&
    n.jumlahBulan >= 1 &&
    n.jumlahBulan <= MAKS_BULAN_GOAL &&
    (n.level !== "leader" || n.unitId !== null) &&
    (n.level !== "account" || n.akunId !== null)
  );
}

/** Angka berformat Indonesia ("1.162.500.000") menjadi bilangan. */
function keAngka(teks: string) {
  const bersih = teks.replace(/[^\d]/g, "");
  return bersih === "" ? 0 : Number(bersih);
}

function Isian({
  id,
  label,
  nilai,
  onUbah,
}: {
  id: string;
  label: string;
  nilai: number;
  onUbah: (n: number) => void;
}) {
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
    </div>
  );
}

const pil = (aktif: boolean) =>
  cn(
    "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
    aktif
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-muted-foreground hover:text-foreground",
  );

const kotakPilih =
  "h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/**
 * Isian goal: judul, sasaran, pemilik, induk, periode, dan target.
 *
 * Periode dipilih sebagai bulan mulai dan bulan selesai; anak tangga
 * bulanannya dipratinjau persis seperti yang akan disimpan. Induk yang
 * ditawarkan hanya yang sah menurut tangga roll-down (0065), dan goal
 * yang sedang diubah beserta turunannya tidak pernah ditawarkan.
 */
export function FormGoal({
  awalan,
  nilai,
  ubah,
  pilihan,
  acuan,
  kecualiInduk = [],
  pratinjauBulan,
  catatanBulan,
}: {
  /** Awalan id elemen supaya dua formulir di satu halaman tidak bentrok. */
  awalan: string;
  nilai: NilaiGoal;
  ubah: (sebagian: Partial<NilaiGoal>) => void;
  pilihan: PilihanGoal;
  /** Tanggal hari ini, dasar pilihan bulan. */
  acuan: string;
  kecualiInduk?: readonly string[];
  /** Anak tangga yang akan tersimpan; bawaannya disusun dari isian. */
  pratinjauBulan?: { bulan: string; target: number }[];
  catatanBulan?: string | null;
}) {
  const unitTerpilih =
    nilai.level === "account"
      ? (pilihan.akun.find((a) => a.id === nilai.akunId)?.unitId ?? null)
      : nilai.unitId;

  const indukSah = useMemo(
    () =>
      pilihan.induk.filter(
        (g) =>
          !kecualiInduk.includes(g.id) &&
          bolehJadiInduk(nilai.level, g.level) &&
          (unitTerpilih === null ||
            g.unitId === null ||
            g.unitId === unitTerpilih),
      ),
    [pilihan.induk, nilai.level, unitTerpilih, kecualiInduk],
  );

  const bulanMulai = pilihanBulanMulai(acuan, nilai.mulai);
  const bulanSelesai = Array.from({ length: MAKS_BULAN_GOAL }, (_, i) =>
    geserBulan(nilai.mulai, i),
  );
  const selesai = akhirPeriode(nilai.mulai, nilai.jumlahBulan);

  const tangga =
    pratinjauBulan ??
    (nilai.target > 0
      ? susunAnakTangga(
          nilai.mulai,
          nilai.jumlahBulan,
          nilai.target,
          nilai.mode,
        )
      : []);

  const labelTarget =
    nilai.jumlahBulan === 1
      ? `untuk ${bulanPendek(nilai.mulai)}`
      : nilai.mode === "bulanan"
        ? "per bulan"
        : "total seluruh periode";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label
          htmlFor={`${awalan}-judul`}
          className="text-[13px] leading-[18px] font-semibold"
        >
          Judul goal
        </label>
        <input
          id={`${awalan}-judul`}
          value={nilai.judul}
          maxLength={120}
          onChange={(e) => ubah({ judul: e.target.value })}
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
              onClick={() =>
                ubah({
                  level: l,
                  indukId: null,
                  ...(l !== "leader" ? { unitId: null } : {}),
                  ...(l !== "account" ? { akunId: null } : {}),
                })
              }
              aria-pressed={l === nilai.level}
              className={pil(l === nilai.level)}
            >
              {NAMA_LEVEL[l]}
            </button>
          ))}
        </div>
      </fieldset>

      {nilai.level === "leader" ? (
        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-[18px] font-semibold">
            Unit
          </legend>
          <div className="flex flex-wrap gap-1">
            {pilihan.unit.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => ubah({ unitId: u.id, indukId: null })}
                aria-pressed={u.id === nilai.unitId}
                className={pil(u.id === nilai.unitId)}
              >
                {u.nama.split(" (")[0]}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {nilai.level === "account" ? (
        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-[18px] font-semibold">
            Akun
          </legend>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {pilihan.akun.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => ubah({ akunId: a.id, indukId: null })}
                aria-pressed={a.id === nilai.akunId}
                className={cn(
                  "baris-interaktif w-full rounded-xl px-3 py-2 text-left text-[13px] leading-[18px] font-medium",
                  a.id === nilai.akunId
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
              onClick={() => ubah({ pemilikId: o.id })}
              aria-pressed={o.id === nilai.pemilikId}
              className={cn(
                "baris-interaktif flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left",
                o.id === nilai.pemilikId
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
                onClick={() =>
                  ubah({ indukId: nilai.indukId === g.id ? null : g.id })
                }
                aria-pressed={g.id === nilai.indukId}
                className={cn(
                  "baris-interaktif w-full rounded-xl px-3 py-2 text-left text-[13px] leading-[18px] font-medium",
                  g.id === nilai.indukId
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

      <fieldset className="space-y-1.5">
        <legend className="text-[13px] leading-[18px] font-semibold">
          Periode target
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label
              htmlFor={`${awalan}-mulai`}
              className="text-[11px] leading-[14px] text-muted-foreground"
            >
              Mulai
            </label>
            <select
              id={`${awalan}-mulai`}
              value={nilai.mulai}
              onChange={(e) => ubah({ mulai: e.target.value })}
              className={kotakPilih}
            >
              {bulanMulai.map((b) => (
                <option key={b} value={b}>
                  {bulanPanjang(b)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`${awalan}-selesai`}
              className="text-[11px] leading-[14px] text-muted-foreground"
            >
              Sampai
            </label>
            <select
              id={`${awalan}-selesai`}
              value={selesai}
              onChange={(e) =>
                ubah({
                  jumlahBulan: jumlahBulanAntara(nilai.mulai, e.target.value),
                })
              }
              className={kotakPilih}
            >
              {bulanSelesai.map((b) => (
                <option key={b} value={b}>
                  {bulanPanjang(b)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] leading-[14px] font-semibold text-info-text">
          <CalendarRange className="size-3.5 shrink-0" />
          {labelPeriode(nilai.mulai, nilai.jumlahBulan)} · {nilai.jumlahBulan}{" "}
          bulan
        </p>
      </fieldset>

      {nilai.jumlahBulan > 1 ? (
        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-[18px] font-semibold">
            Target berlaku
          </legend>
          <div className="flex flex-wrap gap-1">
            {(["bulanan", "total"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => ubah({ mode: m })}
                aria-pressed={m === nilai.mode}
                className={pil(m === nilai.mode)}
              >
                {NAMA_MODE_TARGET[m]}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
            {nilai.mode === "bulanan"
              ? "Angka target di bawah berlaku untuk setiap bulan dalam periode, cocok untuk GMV bulanan."
              : "Angka target di bawah adalah total seluruh periode dan dibagi rata ke setiap bulan."}
          </p>
        </fieldset>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-[13px] leading-[18px] font-semibold">
          Target{" "}
          <span className="font-normal text-muted-foreground">
            ({labelTarget})
          </span>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Isian
            id={`${awalan}-base`}
            label="Base"
            nilai={nilai.base}
            onUbah={(n) => ubah({ base: n })}
          />
          <Isian
            id={`${awalan}-goal`}
            label="Goal"
            nilai={nilai.target}
            onUbah={(n) => ubah({ target: n })}
          />
          <Isian
            id={`${awalan}-stretch`}
            label="Stretch"
            nilai={nilai.stretch}
            onUbah={(n) => ubah({ stretch: n })}
          />
        </div>
        {nilai.base > nilai.target || nilai.target > nilai.stretch ? (
          <p className="text-[11px] leading-[14px] text-warn-text">
            Target harus menanjak: base ≤ goal ≤ stretch.
          </p>
        ) : null}
      </div>

      {tangga.length > 0 ? (
        <div className="space-y-1 rounded-2xl bg-muted/60 px-3 py-2.5">
          <p className="text-[11px] leading-[14px] font-semibold">
            Anak tangga bulanan
          </p>
          <ul className="space-y-0.5 text-[11px] leading-[14px] text-muted-foreground">
            {tangga.map((t) => (
              <li key={t.bulan} className="flex justify-between gap-2">
                <span>{bulanPendek(t.bulan)}</span>
                <span className="tabular-nums">{rupiahRingkas(t.target)}</span>
              </li>
            ))}
          </ul>
          {catatanBulan ? (
            <p className="pt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
              {catatanBulan}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
