"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ChevronUp, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ATASAN_UNTUK,
  adaManagerAktif,
  atasanDisarankan,
  calonAtasan,
  peringatanAtasan,
  sebabAtasanTakSah,
} from "@/lib/atasan";
import { ubahAtasan } from "@/app/actions/anggota";
import type { AnggotaTim, MataRantai } from "@/lib/types";

/**
 * Penetapan atasan.
 *
 * Calon yang ditawarkan hanya yang memenuhi hierarki
 * (CEO → Manager → Leader → Co-Leader → Staff), dan yang paling masuk
 * akal sudah terpilih lebih dulu — yang menekan tombol tinggal
 * membenarkan, bukan menebak. Atasan menentukan siapa yang boleh
 * menugasi orang ini dan menyetujui izinnya, jadi akibat setiap pilihan
 * ditulis sebelum disimpan.
 */
export function DialogAtasan({
  anggota,
  semua,
  rantai,
  idBawahan,
  buka,
  onBuka,
}: {
  anggota: AnggotaTim;
  semua: AnggotaTim[];
  rantai: MataRantai[];
  idBawahan: string[];
  buka: boolean;
  onBuka: (b: boolean) => void;
}) {
  const bawahan = new Set(idBawahan);
  const opsi = { adaManager: adaManagerAktif(semua) };
  const calon = calonAtasan(semua, anggota, bawahan);
  const usulan = atasanDisarankan(semua, anggota, bawahan);

  // Atasan sekarang dipertahankan bila masih sah; kalau tidak, usulan
  // yang dipilih lebih dulu supaya tombol simpan langsung berarti.
  const atasanKini = semua.find((a) => a.id === anggota.atasanId) ?? null;
  const kiniSah =
    atasanKini !== null && calon.some((c) => c.id === atasanKini.id);
  const [pilih, setPilih] = useState<string | null>(
    kiniSah ? anggota.atasanId : (usulan?.id ?? null),
  );
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const terpilih = calon.find((c) => c.id === pilih) ?? null;
  const peringatan = peringatanAtasan(anggota, terpilih, opsi);
  const adaYangSalah = peringatan.some((p) => p.nada === "salah");
  const sebabKini =
    atasanKini && !kiniSah
      ? atasanKini.status !== "aktif"
        ? `${atasanKini.nama} sudah nonaktif.`
        : sebabAtasanTakSah(anggota, atasanKini, opsi)
      : null;
  const peranBoleh = ATASAN_UNTUK[anggota.role];

  const simpan = () => {
    if (menyimpan || adaYangSalah) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await ubahAtasan(anggota.id, pilih);
      if (hasil.ok) {
        onBuka(false);
        return;
      }
      setPesan(hasil.pesan ?? null);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atasan {anggota.nama}</DialogTitle>
          <DialogDescription>
            {anggota.role === "CEO"
              ? "CEO berada di puncak dan tidak melapor kepada siapa pun."
              : `${anggota.role} melapor kepada ${peranBoleh.join(" atau ")}${
                  anggota.role === "Co-Leader" || anggota.role === "Staff"
                    ? " di unitnya sendiri"
                    : ""
                }. Atasan berwenang menugasi dan menyetujui izin orang ini.`}
          </DialogDescription>
        </DialogHeader>

        {rantai.length > 0 ? (
          <div className="rounded-2xl bg-muted px-3 py-2.5">
            <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              Garis pelaporan sekarang
            </p>
            <ul className="mt-1 space-y-0.5">
              {rantai.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center gap-1.5 text-[11px] leading-[16px]"
                  style={{ paddingLeft: `${(m.tingkat - 1) * 10}px` }}
                >
                  <ChevronUp className="size-3 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{m.nama}</span>
                  <span className="truncate text-muted-foreground">
                    {m.jabatan}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {sebabKini ? (
          <p className="rounded-2xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-warn-text">
            Atasan sekarang ({atasanKini?.nama}) tidak lagi sesuai aturan:{" "}
            {sebabKini} Pilih penggantinya di bawah.
          </p>
        ) : null}

        {idBawahan.length > 0 ? (
          <p className="rounded-2xl bg-info-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-info-text">
            {idBawahan.length} orang melapor kepada {anggota.nama}. Mengubah
            atasannya menggeser seluruh cabang ini, bukan satu orang saja.
          </p>
        ) : null}

        {anggota.role !== "CEO" && calon.length === 0 ? (
          <p className="rounded-2xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-warn-text">
            Belum ada {peranBoleh.join(" atau ")} aktif
            {anggota.role === "Co-Leader" || anggota.role === "Staff"
              ? ` di ${anggota.unitNama}`
              : ""}
            . Tetapkan dulu orangnya, baru atasan ini bisa dipilih.
          </p>
        ) : null}

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {calon.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setPilih(c.id)}
              aria-pressed={pilih === c.id}
              className={cn(
                "baris-interaktif flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left",
                pilih === c.id
                  ? "bg-primary/10 ring-1 ring-primary/30"
                  : "bg-muted/50",
              )}
            >
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="bg-card text-[11px] font-semibold text-muted-foreground">
                  {c.inisial}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] leading-[18px] font-semibold">
                    {c.nama}
                  </span>
                  {usulan?.id === c.id ? (
                    <span className="shrink-0 rounded-full bg-ok-fill px-1.5 py-0.5 text-[10px] leading-[12px] font-semibold text-ok-text">
                      disarankan
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                  {c.role} · {c.jabatan}
                </span>
              </span>
              <span className="shrink-0 text-[11px] leading-[14px] text-muted-foreground">
                {c.unitNama}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPilih(null)}
          aria-pressed={pilih === null}
          className={cn(
            "tekan-halus rounded-xl px-3 py-2 text-left text-[11px] leading-[14px] font-semibold",
            pilih === null
              ? "bg-warn-fill text-warn-text"
              : "bg-muted text-muted-foreground",
          )}
        >
          Tanpa atasan
        </button>

        {peringatan.length > 0 ? (
          <ul className="space-y-1.5">
            {peringatan.map((p) => (
              <li
                key={p.pesan}
                className={cn(
                  "flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-[14px] text-pretty",
                  p.nada === "salah"
                    ? "bg-danger-fill text-danger-text"
                    : "bg-warn-fill text-warn-text",
                )}
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {p.pesan}
              </li>
            ))}
          </ul>
        ) : null}

        {pesan ? (
          <p
            role="status"
            className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text"
          >
            {pesan}
          </p>
        ) : null}

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
            disabled={menyimpan || adaYangSalah || pilih === anggota.atasanId}
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            {menyimpan ? "Menyimpan…" : "Simpan atasan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
