"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Network, Pencil, Store } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { gayaUnit } from "@/lib/unit";
import { GAYA_PERAN } from "@/lib/gaya-peran";
import { DialogAtasan } from "@/components/tim/dialog-atasan";
import { LencanaStatus } from "@/components/tim/lencana-status";
import { TombolStatusAnggota } from "@/components/tim/tombol-status-anggota";
import { DialogUbahAnggota } from "@/components/tim/dialog-anggota";
import type { AnggotaTim, MataRantai, PilihanOrganisasi } from "@/lib/types";

function BarisAnggota({
  anggota,
  pilihan,
  semua,
  rantai,
  bawahan,
  bolehKelola,
}: {
  anggota: AnggotaTim;
  pilihan: PilihanOrganisasi;
  semua: AnggotaTim[];
  rantai: Record<string, MataRantai[]>;
  bawahan: Record<string, string[]>;
  bolehKelola: boolean;
}) {
  const [bukaUbah, setBukaUbah] = useState(false);
  const [bukaAtasan, setBukaAtasan] = useState(false);
  return (
    <li
      className={cn(
        "baris-interaktif flex flex-wrap items-center gap-3 rounded-2xl bg-muted/50 p-3",
        anggota.status === "nonaktif" && "opacity-60",
      )}
    >
      <Avatar className="size-9 shrink-0">
        <AvatarFallback className="bg-card text-[11px] font-semibold text-muted-foreground">
          {anggota.inisial}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-[9rem] flex-1">
        <p className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/tim/${anggota.id}`}
            className="truncate text-sm leading-5 font-semibold hover:underline"
          >
            {anggota.nama}
          </Link>
          <LencanaStatus status={anggota.status} />
        </p>
        <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
          {anggota.jabatan}
        </p>
        <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
          {anggota.atasanNama ? (
            <>Atasan: {anggota.atasanNama}</>
          ) : (
            <span className="text-warn-text">Belum punya atasan</span>
          )}
        </p>
        {anggota.email ? (
          <p className="flex items-center gap-1 truncate text-[11px] leading-[14px] text-muted-foreground">
            <Mail className="size-3 shrink-0" />
            {anggota.email}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
            GAYA_PERAN[anggota.role],
          )}
        >
          {anggota.role}
        </span>
        {anggota.akunDipegang > 0 ? (
          <span className="flex items-center gap-1 text-[10px] leading-[14px] text-muted-foreground">
            <Store className="size-3 shrink-0" />
            {anggota.akunDipegang} akun
          </span>
        ) : null}
      </div>

      {bolehKelola ? (
        <div className="flex basis-full items-center justify-end gap-1 sm:basis-auto">
          <Button
            type="button"
            variant="ghost"
            aria-label={`Ubah ${anggota.nama}`}
            onClick={() => setBukaUbah(true)}
            className="tekan-halus sentuh-nyaman size-8 rounded-full p-0"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label={`Atur atasan ${anggota.nama}`}
            onClick={() => setBukaAtasan(true)}
            className="tekan-halus sentuh-nyaman size-8 rounded-full p-0"
          >
            <Network className="size-3.5" />
          </Button>
          <TombolStatusAnggota anggota={anggota} />

          <DialogUbahAnggota
            anggota={anggota}
            pilihan={pilihan}
            buka={bukaUbah}
            onBuka={setBukaUbah}
          />

          <DialogAtasan
            anggota={anggota}
            semua={semua}
            rantai={rantai[anggota.id] ?? []}
            idBawahan={bawahan[anggota.id] ?? []}
            buka={bukaAtasan}
            onBuka={setBukaAtasan}
          />
        </div>
      ) : null}
    </li>
  );
}

/** Daftar anggota tim, dikelompokkan per unit. */
export function DaftarAnggota({
  kelompok,
  pilihan,
  semua,
  rantai,
  bawahan,
  bolehKelola,
}: {
  kelompok: { unit: string; unitKode: string | null; anggota: AnggotaTim[] }[];
  pilihan: PilihanOrganisasi;
  semua: AnggotaTim[];
  rantai: Record<string, MataRantai[]>;
  bawahan: Record<string, string[]>;
  bolehKelola: boolean;
}) {
  if (kelompok.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada anggota yang terlihat untukmu.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {kelompok.map((k) => {
        const gaya =
          k.unitKode && k.unitKode in gayaUnit
            ? gayaUnit[k.unitKode as keyof typeof gayaUnit]
            : null;

        return (
          <Card
            key={k.unit}
            className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle"
          >
            <div className="flex items-center justify-between gap-3 px-5">
              <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    gaya?.titik ?? "bg-muted-foreground/40",
                  )}
                />
                {k.unit}
              </h2>
              <span className="tabular shrink-0 text-[11px] leading-[14px] text-muted-foreground">
                {k.anggota.length} orang
              </span>
            </div>

            <ul className="space-y-2 px-5">
              {k.anggota.map((a) => (
                <BarisAnggota
                  key={a.id}
                  anggota={a}
                  pilihan={pilihan}
                  semua={semua}
                  rantai={rantai}
                  bawahan={bawahan}
                  bolehKelola={bolehKelola}
                />
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
