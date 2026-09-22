"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ItemNotifikasi } from "@/components/notifikasi/item-notifikasi";
import { labelLencana, type Notifikasi } from "@/lib/notifikasi";

/** Berapa notifikasi terbaru yang muat di laci tanpa perlu digulir jauh. */
const TAMPIL = 5;

/**
 * Lonceng di app-bar: lencana angka dan laci berisi yang terbaru.
 *
 * Lencananya angka sungguhan, bukan titik merah yang selalu menyala —
 * titik yang tidak pernah padam mengajarkan orang untuk berhenti
 * melihatnya.
 *
 * Lacinya sengaja hanya memuat lima yang terbaru: ia untuk melirik,
 * bukan untuk menelusuri. Yang ingin menelusuri punya halaman sendiri,
 * dan tautannya selalu ada di bawah.
 */
export function Lonceng({
  daftar,
  belumDibaca,
  hariIni,
  waGagal,
}: {
  daftar: Notifikasi[];
  /**
   * Hitungan yang belum dibaca dari basis data.
   *
   * Bukan dihitung dari `daftar`: daftar itu hanya 200 terbaru, dan
   * lencana yang ikut terbatas akan berhenti bertambah tanpa ada yang
   * sadar.
   */
  belumDibaca: number;
  hariIni: string;
  /** Id notifikasi yang pesan WhatsApp-nya gagal terkirim. */
  waGagal: Set<string>;
}) {
  const [buka, setBuka] = useState(false);
  const belum = belumDibaca;
  const lencana = labelLencana(belum);
  const terbaru = daftar.slice(0, TAMPIL);

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={
            lencana
              ? `Notifikasi, ${belum} belum dibaca`
              : "Notifikasi, semua sudah dibaca"
          }
          className="tekan-halus sentuh-nyaman relative flex size-9 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground"
        >
          <Bell className="size-4" />
          {lencana ? (
            <span className="tabular absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-bold text-white">
              {lencana}
            </span>
          ) : null}
        </button>
      </DialogTrigger>

      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notifikasi</DialogTitle>
          <DialogDescription>
            {belum > 0
              ? `${belum} belum dibaca dari ${daftar.length} notifikasi.`
              : `Semua sudah dibaca — ${daftar.length} notifikasi tercatat.`}
          </DialogDescription>
        </DialogHeader>

        {terbaru.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <BellOff className="size-4" />
            </span>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Belum ada notifikasi. Ia terbit sendiri saat ada tugas baru,
              tenggat mendekat, atau keputusan atas pengajuanmu.
            </p>
          </div>
        ) : (
          <ul className="-mx-1 max-h-[60vh] space-y-0.5 overflow-y-auto">
            {terbaru.map((n) => (
              <li key={n.id} onClick={() => setBuka(false)}>
                <ItemNotifikasi
                  n={n}
                  hariIni={hariIni}
                  ringkas
                  waGagal={waGagal.has(n.id)}
                />
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/notifikasi"
          onClick={() => setBuka(false)}
          className="tekan-halus sentuh-nyaman inline-flex h-9 items-center justify-center rounded-full bg-card px-4 text-[11px] leading-[14px] font-semibold ring-1 ring-border-subtle"
        >
          {daftar.length > TAMPIL
            ? `Lihat semua (${daftar.length})`
            : "Buka pusat notifikasi"}
        </Link>
      </DialogContent>
    </Dialog>
  );
}
