"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bilangan, rupiahPenuh } from "@/lib/format";
import {
  ENTITAS_TAHAP_2,
  LABEL_ARAH,
  gayaBanding,
  nilaiBanding,
  type KelompokBanding,
} from "@/lib/banding";

/**
 * Pembanding V1 vs V2, satu kelompok per kartu.
 *
 * Kedua angka ditampilkan berdampingan, bukan hanya selisihnya: orang
 * yang memeriksa perlu tahu dari mana selisihnya datang, dan angka
 * tunggal "beda 12" tidak pernah cukup untuk memutuskan apa pun.
 */
/** Berapa baris ditampilkan sebelum sisanya disembunyikan. */
const BATAS_TAMPIL = 8;

export function TabelBanding({ kelompok }: { kelompok: KelompokBanding }) {
  const [semua, setSemua] = useState(false);

  // Yang berselisih selalu tampil. Sisanya dipotong: satu kelompok bisa
  // berisi puluhan baris unit-bulan, dan tabel yang tidak habis dibaca
  // sama saja dengan tabel yang tidak dibaca.
  const berselisih = kelompok.baris.filter(
    (b) => nilaiBanding(b).status === "selisih",
  );
  const sisanya = kelompok.baris.filter(
    (b) => nilaiBanding(b).status !== "selisih",
  );
  const tampil = semua
    ? kelompok.baris
    : [...berselisih, ...sisanya].slice(
        0,
        Math.max(BATAS_TAMPIL, berselisih.length),
      );
  const tersembunyi = kelompok.baris.length - tampil.length;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">{kelompok.judul}</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {kelompok.keterangan}
        </p>
      </div>

      <div className="px-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse">
            <thead>
              <tr className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                <th className="py-1.5 text-left">Ukuran</th>
                <th className="py-1.5 text-right">K-Space lama</th>
                <th className="py-1.5 text-right">K-Space V2</th>
                <th className="py-1.5 text-right">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((b) => {
                const nilai = nilaiBanding(b);
                const tulis = (n: number | null) =>
                  n === null
                    ? "—"
                    : b.satuan === "rupiah"
                      ? rupiahPenuh(n)
                      : bilangan(n);

                return (
                  <tr
                    key={b.ukuran}
                    className="border-t border-border-subtle align-top"
                  >
                    <td className="py-2 pr-3 text-[13px] leading-[18px]">
                      <span className="block font-semibold">{b.ukuran}</span>
                      <span className="block text-[11px] leading-[14px] text-pretty text-muted-foreground">
                        {b.catatan ?? nilai.keterangan}
                      </span>
                    </td>
                    <td className="tabular py-2 text-right text-[13px] leading-[18px] whitespace-nowrap">
                      {tulis(b.v1)}
                    </td>
                    <td className="tabular py-2 text-right text-[13px] leading-[18px] whitespace-nowrap">
                      {tulis(b.v2)}
                    </td>
                    <td className="py-2 pl-3 text-right whitespace-nowrap">
                      <span
                        className={cn(
                          "tabular inline-flex rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
                          gayaBanding(nilai),
                        )}
                      >
                        {nilai.selisih === null
                          ? "belum"
                          : nilai.selisih === 0
                            ? "cocok"
                            : `${nilai.selisih > 0 ? "+" : "−"}${tulis(Math.abs(nilai.selisih))}`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-[14px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-danger-fill" />
            {LABEL_ARAH.kurang}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-warn-fill" />
            {LABEL_ARAH.lebih}
          </span>
        </p>

        {tersembunyi > 0 || semua ? (
          <button
            type="button"
            onClick={() => setSemua((s) => !s)}
            className="baris-interaktif mt-1 w-full rounded-xl px-1 py-2 text-left text-[13px] leading-[18px] font-semibold"
          >
            {semua
              ? "Tampilkan yang perlu perhatian saja"
              : `Tampilkan ${tersembunyi} ukuran lainnya`}
          </button>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Entitas yang memang belum ikut dipindahkan.
 *
 * Ditulis apa adanya supaya orang yang mencari data sampel atau
 * pengumuman lamanya menemukan jawabannya di sini — bukan menyimpulkan
 * bahwa migrasinya rusak.
 */
export function BelumDimigrasi({
  jumlah = {},
}: {
  /** Berapa entri yang menunggu di ekspor, per entitas. */
  jumlah?: Record<string, number>;
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Belum dimigrasi</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Kesembilan hal ini sengaja belum dipindahkan pada tahap ini. Datanya
          masih ada di K-Space lama dan bisa diambil belakangan; yang tidak
          boleh terjadi adalah orang mengira ia hilang.
        </p>
      </div>

      <ul className="flex flex-wrap gap-1.5 px-5">
        {ENTITAS_TAHAP_2.map((e) => {
          const n = jumlah[e.kunci] ?? 0;
          return (
            <li
              key={e.kunci}
              className={
                n > 0
                  ? "tabular rounded-full bg-info-fill px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-info-text"
                  : "rounded-full bg-muted px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-muted-foreground"
              }
            >
              {e.label}
              {n > 0 ? ` · ${n} menunggu` : " · tidak ada di ekspor"}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
