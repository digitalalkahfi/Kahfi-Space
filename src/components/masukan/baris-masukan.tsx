"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bug,
  ChevronDown,
  MessageSquare,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tanggalRelatif } from "@/lib/format";
import {
  GAYA_JENIS,
  GAYA_KEPARAHAN,
  GAYA_STATUS_MASUKAN,
  LABEL_JENIS,
  LABEL_KEPARAHAN,
  LABEL_STATUS_MASUKAN,
  type Masukan,
} from "@/lib/masukan";
import { TombolStatusMasukan } from "@/components/masukan/panel-status-masukan";

/**
 * Satu masukan di daftar.
 *
 * Mengetuknya membuka deskripsinya di tempat — membaca laporan tidak
 * perlu berpindah halaman. Pengelola langsung mendapat tombol tindak
 * lanjut di situ juga; balasan dan jejak lengkap tetap di halaman detail.
 */
export function BarisMasukan({
  masukan: m,
  acuan,
  bolehKelola,
}: {
  masukan: Masukan;
  acuan: string;
  bolehKelola: boolean;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const gaya = GAYA_STATUS_MASUKAN[m.status];
  const idIsi = `isi-masukan-${m.id}`;

  return (
    <li className="rounded-2xl bg-muted/50">
      <button
        type="button"
        onClick={() => setTerbuka(!terbuka)}
        aria-expanded={terbuka}
        aria-controls={idIsi}
        className="tekan-halus w-full p-3.5 text-left"
      >
        <span className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-2xl",
              m.jenis === "bug"
                ? "bg-danger-fill text-danger-text"
                : "bg-card text-muted-foreground",
            )}
          >
            {m.jenis === "bug" ? (
              <Bug className="size-4" />
            ) : (
              <MessageSquare className="size-4" />
            )}
          </span>

          <span className="min-w-[10rem] flex-1">
            <span className="block text-sm leading-5 font-semibold text-pretty">
              {m.judul}
            </span>
            <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
              {m.pelaporNama ?? "Anonim"}
              {m.halaman ? ` · ${m.halaman}` : ""} ·{" "}
              {tanggalRelatif(m.dibuatPada, acuan)}
            </span>
          </span>

          <span className="flex h-fit shrink-0 items-center gap-1.5">
            <span className="flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[11px] leading-[14px] font-semibold">
              <ThumbsUp
                className={cn(
                  "size-3",
                  m.sayaDukung ? "text-secondary" : "text-muted-foreground",
                )}
              />
              {m.dukungan}
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                terbuka && "rotate-180",
              )}
              aria-hidden
            />
          </span>
        </span>

        <span className="mt-2 flex flex-wrap gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
              gaya.kelas,
            )}
          >
            <span className={cn("size-1.5 rounded-full", gaya.titik)} />
            {LABEL_STATUS_MASUKAN[m.status]}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
              GAYA_JENIS[m.jenis],
            )}
          >
            {LABEL_JENIS[m.jenis]}
          </span>
          {m.keparahan ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
                GAYA_KEPARAHAN[m.keparahan],
              )}
            >
              {m.keparahan === "kritis" ? (
                <TriangleAlert className="size-3" />
              ) : null}
              {LABEL_KEPARAHAN[m.keparahan]}
            </span>
          ) : null}
          {m.komentar.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-muted-foreground">
              <MessageSquare className="size-3" />
              {m.komentar.length}
            </span>
          ) : null}
        </span>

        {!terbuka && m.status === "ditolak" && m.alasanTolak ? (
          <span className="mt-2 block text-[11px] leading-[14px] text-pretty text-muted-foreground">
            Ditolak: {m.alasanTolak}
          </span>
        ) : null}
      </button>

      {terbuka ? (
        <div id={idIsi} className="space-y-3 px-3.5 pb-3.5">
          <p className="rounded-xl bg-card px-3.5 py-3 text-[13px] leading-[20px] whitespace-pre-line text-pretty">
            {m.isi.trim() ? m.isi : "Pelapor tidak menulis deskripsi."}
          </p>

          {m.status === "ditolak" && m.alasanTolak ? (
            <p className="rounded-xl bg-muted px-3.5 py-2.5 text-[12px] leading-[16px] text-pretty text-muted-foreground">
              Ditolak: {m.alasanTolak}
            </p>
          ) : null}

          {bolehKelola ? <TombolStatusMasukan masukan={m} /> : null}

          <Link
            href={`/masukan/${m.id}`}
            className="tekan-halus inline-flex items-center gap-1 text-[11px] leading-[14px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
          >
            {m.komentar.length > 0
              ? `Lihat ${m.komentar.length} balasan & jejak`
              : "Balas atau lihat jejak"}
            <ArrowRight className="size-3" />
          </Link>
        </div>
      ) : null}
    </li>
  );
}
