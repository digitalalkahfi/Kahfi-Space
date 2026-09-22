"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Clock, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { jamWib, persen } from "@/lib/format";
import { ubahCentangToDo } from "@/app/actions/tugas";
import type { Prioritas, ToDo } from "@/lib/types";

const warnaPrioritas: Record<Prioritas, string> = {
  tinggi: "bg-danger",
  sedang: "bg-unit-mcn",
  rendah: "bg-unit-tap",
};

/**
 * "To-do hari ini" (PRD §3 Beranda): daftar pekerjaan pribadi yang harus
 * kelar hari ini, bisa dicentang langsung dari beranda. Pembuatan dan
 * pengelolaan penuh tetap di menu Tugas.
 */
export function ToDoHariIni({ todo }: { todo: ToDo[] }) {
  const [, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  // Centang terasa seketika; kalau server menolak, pesannya muncul di kaki kartu.
  const [daftar, centangOptimis] = useOptimistic(
    todo,
    (kini: ToDo[], id: string) =>
      kini.map((t) => (t.id === id ? { ...t, selesai: !t.selesai } : t)),
  );

  const selesai = daftar.filter((t) => t.selesai).length;
  const total = daftar.length;
  const rasio = total > 0 ? (selesai / total) * 100 : 0;

  const centang = (id: string, selesaiBaru: boolean) => {
    mulai(async () => {
      centangOptimis(id);
      const hasil = await ubahCentangToDo(id, selesaiBaru);
      setPesan(hasil.ok ? null : hasil.pesan);
    });
  };

  return (
    <Card className="kartu-interaktif ring-border-subtle rounded-3xl shadow-card">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">To-do Hari Ini</h2>
          <p className="tabular text-[13px] leading-[18px] text-muted-foreground">
            {selesai} dari {total} selesai · {persen(rasio, 0)}
          </p>
        </div>
        <Link
          href="/tugas"
          aria-label="Buka menu Tugas untuk menambah to-do"
          className="tekan-halus sentuh-nyaman flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Plus className="size-4" />
        </Link>
      </div>

      <div className="px-5">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(rasio)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progres to-do hari ini"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${rasio}%` }}
          />
        </div>
      </div>

      {daftar.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada to-do hari ini. Tambah lewat menu Tugas.
        </p>
      ) : null}

      <ul className="space-y-1.5 px-5">
        {daftar.map((t) => (
          <li key={t.id}>
            <label
              className={cn(
                "baris-interaktif flex cursor-pointer items-start gap-3 rounded-2xl p-3",
                t.selesai ? "bg-muted/50" : "bg-muted/60 sm:bg-muted/40",
              )}
            >
              <Checkbox
                checked={t.selesai}
                onCheckedChange={() => centang(t.id, !t.selesai)}
                className="mt-0.5 shrink-0 rounded-full"
              />

              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm leading-5 font-semibold text-pretty transition-colors",
                      t.selesai && "text-muted-foreground line-through",
                    )}
                  >
                    {t.judul}
                  </span>
                  {t.jam ? (
                    <span className="tabular flex shrink-0 items-center gap-1 text-[11px] leading-[14px] text-muted-foreground">
                      <Clock className="size-3" />
                      {jamWib(t.jam)}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      warnaPrioritas[t.prioritas],
                      t.selesai && "opacity-40",
                    )}
                  />
                  <span className="truncate text-[11px] leading-[14px] text-muted-foreground">
                    {t.konteks}
                  </span>
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 pt-3 text-[13px] leading-[18px]">
        <span
          className={cn(
            "min-w-0 truncate",
            pesan ? "text-warn-text" : "text-muted-foreground",
          )}
          role={pesan ? "status" : undefined}
        >
          {pesan ??
            (total - selesai === 0
              ? "Semua to-do hari ini beres"
              : `${total - selesai} belum dikerjakan`)}
        </span>
        <Link
          href="/tugas"
          className="sentuh-nyaman font-semibold text-secondary hover:underline"
        >
          Kelola di Tugas
        </Link>
      </div>
    </Card>
  );
}
