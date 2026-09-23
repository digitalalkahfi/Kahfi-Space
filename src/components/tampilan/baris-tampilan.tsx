"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItemTampilan } from "@/lib/tampilan";

type Isi = {
  item: ItemTampilan;
  aktif: boolean;
  /** Id paragraf yang menjelaskan kenapa item inti terkunci. */
  idAlasan: string;
  onAlih: () => void;
};

/**
 * Tampilan satu baris; tidak tahu apa-apa soal geser-lepas.
 *
 * Pegangannya dipisah dari kotak centangnya dengan sengaja. Kalau
 * seluruh kartu bisa diseret, setiap ketukan untuk mencentang berisiko
 * terbaca sebagai awal seretan — dan di ponsel itu berarti centang
 * yang tidak jadi.
 */
function IsiBaris({
  item,
  aktif,
  idAlasan,
  onAlih,
  pegangan,
}: Isi & { pegangan: React.ReactNode }) {
  return (
    <>
      {pegangan}

      <button
        type="button"
        role="checkbox"
        aria-checked={aktif}
        aria-label={item.label}
        aria-disabled={item.inti || undefined}
        // Bukan `title`: pembaca layar tidak selalu membacakannya, dan
        // pemakai keyboard yang berhenti di sini justru yang paling
        // butuh tahu kenapa centangnya tidak bergerak.
        aria-describedby={item.inti ? idAlasan : undefined}
        onClick={item.inti ? undefined : onAlih}
        className={cn(
          "tekan-halus flex min-w-0 flex-1 items-start gap-2.5 rounded-2xl py-3 pr-3 text-left",
          item.inti && "cursor-default",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "mt-px flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
            aktif
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input",
          )}
        >
          {aktif ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>

        <span className="min-w-0">
          <span className="block text-[13px] leading-[18px] font-semibold">
            {item.label}
          </span>
          <span className="block text-[11px] leading-[14px] text-pretty text-muted-foreground">
            {item.keterangan}
          </span>
        </span>
      </button>
    </>
  );
}

function kelasBaris(item: ItemTampilan, aktif: boolean, terangkat: boolean) {
  return cn(
    "flex items-start gap-1 rounded-2xl ring-1 transition-colors",
    item.inti
      ? "bg-muted/40 ring-transparent"
      : aktif
        ? "bg-muted/70 ring-border"
        : "bg-muted/30 ring-transparent",
    // Yang sedang diseret diangkat sedikit supaya jelas ia yang
    // berpindah, bukan daftar di bawahnya yang bergeser sendiri.
    terangkat && "z-10 shadow-overlay ring-border",
  );
}

/**
 * Baris menu inti: tidak bisa digeser sama sekali.
 *
 * Ia dirender DI LUAR area geser, bukan sekadar `disabled`. Bedanya
 * terasa: kalau ia ikut di dalam, item lain masih bisa dijatuhkan di
 * atasnya, daftarnya bergeser saat diseret, lalu melompat kembali
 * setelah dilepas. Di luar area, posisinya memang tidak pernah
 * tergoyang.
 */
export function BarisTetap(props: Isi) {
  return (
    <li className={kelasBaris(props.item, props.aktif, false)}>
      <IsiBaris
        {...props}
        pegangan={
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center self-center text-muted-foreground/40"
          >
            <Lock className="size-3.5" />
          </span>
        }
      />
    </li>
  );
}

/** Baris biasa: bisa diseret lewat pegangannya. */
export function BarisSortable(props: Isi) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.item.kunci });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={kelasBaris(props.item, props.aktif, isDragging)}
    >
      <IsiBaris
        {...props}
        pegangan={
          <button
            type="button"
            ref={setActivatorNodeRef}
            aria-label={`Geser ${props.item.label}`}
            // `touch-none` wajib pada pegangan seret berbasis Pointer
            // Events: tanpa itu, di layar sentuh browser mengambil alih
            // gerakannya sebagai gulir halaman dan seretannya tidak
            // pernah dimulai. Papan Kanban sudah memakainya sejak awal.
            className="flex size-9 shrink-0 touch-none cursor-grab items-center justify-center self-center rounded-xl text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </li>
  );
}
