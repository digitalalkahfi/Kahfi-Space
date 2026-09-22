"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, PencilLine } from "lucide-react";
import { DialogRevisi } from "@/components/laporan-harian/dialog-revisi";
import { TombolUnduhExcel } from "@/components/shared/tombol-unduh-excel";
import { namaBerkasTanggal, type KolomEkspor } from "@/lib/ekspor-excel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  jamWib,
  persen,
  rasioCapaian,
  rupiahPenuh,
  rupiahRingkas,
  tanggalPendek,
} from "@/lib/format";
import type { LaporanHarian, RevisiLaporan } from "@/lib/types";

const SEMUA = "semua";

/**
 * Riwayat laporan yang pernah dikirim, bisa disaring per akun/unit.
 * Tabel di layar lebar, kartu bertumpuk di HP.
 */
export function TabelRiwayat({
  riwayat,
  olehNama,
}: {
  riwayat: LaporanHarian[];
  olehNama: string;
}) {
  const [saringan, setSaringan] = useState(SEMUA);
  // Koreksi yang baru saja disimpan agar angkanya langsung terlihat benar
  // sebelum halaman di-revalidate server.
  const [revisi, setRevisi] = useState<RevisiLaporan[]>([]);
  const [koreksi, setKoreksi] = useState<Record<string, number>>({});

  const jejakUntuk = (id: string) =>
    revisi
      .filter((r) => r.reportId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const simpanRevisi = (baru: RevisiLaporan) => {
    setRevisi((s) => [...s, baru]);
    setKoreksi((s) => ({ ...s, [baru.reportId]: baru.gmvBaru }));
  };

  const gmvKini = (r: LaporanHarian) => koreksi[r.id] ?? r.gmv;

  const label = useMemo(
    () => Array.from(new Set(riwayat.map((r) => r.label))),
    [riwayat],
  );

  const daftar = useMemo(
    () =>
      (saringan === SEMUA
        ? riwayat
        : riwayat.filter((r) => r.label === saringan)
      )
        .slice()
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [riwayat, saringan],
  );

  const kolomEkspor: KolomEkspor<LaporanHarian>[] = [
    { judul: "Tanggal", ambil: (r) => r.tanggal, lebar: 12 },
    { judul: "Jam kirim", ambil: (r) => jamWib(r.submittedAt), lebar: 12 },
    { judul: "Akun / unit", ambil: (r) => r.label, lebar: 24 },
    { judul: "GMV (Rp)", ambil: (r) => gmvKini(r), lebar: 16 },
    { judul: "Target (Rp)", ambil: (r) => r.target, lebar: 16 },
    {
      judul: "Capaian (%)",
      ambil: (r) => Number(rasioCapaian(gmvKini(r), r.target).toFixed(1)),
      lebar: 12,
    },
    {
      judul: "Revisi",
      ambil: (r) => Math.max(r.jumlahRevisi, jejakUntuk(r.id).length),
      lebar: 8,
    },
    { judul: "Catatan", ambil: (r) => r.catatan, lebar: 48 },
  ];

  const totalGmv = daftar.reduce((a, r) => a + gmvKini(r), 0);
  const totalTarget = daftar.reduce((a, r) => a + r.target, 0);
  const jumlahRevisi = daftar.reduce(
    (a, r) => a + Math.max(r.jumlahRevisi, jejakUntuk(r.id).length),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[SEMUA, ...label].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setSaringan(l)}
              aria-pressed={l === saringan}
              className={cn(
                "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold",
                l === saringan
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
              )}
            >
              {l === SEMUA ? "Semua akun" : l}
            </button>
          ))}
        </div>

        <TombolUnduhExcel
          baris={daftar}
          kolom={kolomEkspor}
          namaBerkas={namaBerkasTanggal(
            saringan === SEMUA
              ? "k-space-laporan-harian"
              : `k-space-laporan-${saringan.replace(/[^a-z0-9]+/gi, "-")}`,
          )}
          namaSheet="Laporan Harian"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Laporan", nilai: String(daftar.length) },
          { label: "Total GMV", nilai: rupiahRingkas(totalGmv) },
          {
            label: "Capaian",
            nilai: persen(rasioCapaian(totalGmv, totalTarget)),
          },
        ].map((k) => (
          <Card
            key={k.label}
            className="rounded-2xl shadow-card ring-border-subtle"
          >
            <div className="px-4">
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                {k.label}
              </p>
              <p className="tabular mt-0.5 text-base leading-6 font-bold tracking-tight">
                {k.nilai}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop: tabel padat */}
      <Card className="hidden rounded-3xl shadow-card ring-border-subtle lg:block">
        <div className="overflow-x-auto px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Akun / unit</TableHead>
                <TableHead className="text-right">GMV</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Capaian</TableHead>
                <TableHead>Status &amp; perbaikan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daftar.map((r) => {
                const gmv = gmvKini(r);
                const rasio = rasioCapaian(gmv, r.target);
                const tercapai = gmv >= r.target;
                const jejak = jejakUntuk(r.id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      <span className="block font-medium">
                        {tanggalPendek(r.tanggal)}
                      </span>
                      <span className="tabular block text-[11px] leading-[14px] text-muted-foreground">
                        {jamWib(r.submittedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[16rem]">
                      <Link
                        href={`/laporan-harian/riwayat/${encodeURIComponent(r.id)}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {r.label}
                      </Link>
                      <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                        {r.catatan}
                      </span>
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold whitespace-nowrap">
                      {rupiahPenuh(gmv)}
                    </TableCell>
                    <TableCell className="tabular text-right whitespace-nowrap text-muted-foreground">
                      {rupiahRingkas(r.target)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "tabular rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                          tercapai
                            ? "bg-ok-fill text-ok-text"
                            : "bg-warn-fill text-warn-text",
                        )}
                      >
                        {persen(rasio)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-between gap-2">
                        {jejak.length > 0 ? (
                          <span className="flex items-center gap-1 text-[11px] leading-[14px] font-semibold text-warn-text">
                            <PencilLine className="size-3" />
                            {jejak.length} revisi
                          </span>
                        ) : (
                          <span className="text-[11px] leading-[14px] text-ok-text">
                            Terkirim
                          </span>
                        )}
                        <DialogRevisi
                          laporan={{ ...r, gmv }}
                          jejak={jejak}
                          olehNama={olehNama}
                          onSimpan={simpanRevisi}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* HP & tablet: kartu bertumpuk */}
      <div className="space-y-2.5 lg:hidden">
        {daftar.map((r) => {
          const gmv = gmvKini(r);
          const rasio = rasioCapaian(gmv, r.target);
          const tercapai = gmv >= r.target;
          const jejak = jejakUntuk(r.id);
          return (
            <Card
              key={r.id}
              className="kartu-interaktif rounded-2xl shadow-card ring-border-subtle"
            >
              <div className="space-y-2 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/laporan-harian/riwayat/${encodeURIComponent(r.id)}`}
                      className="flex items-center gap-1 truncate text-[13px] leading-[18px] font-semibold"
                    >
                      <span className="truncate">{r.label}</span>
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                    <p className="tabular text-[11px] leading-[14px] text-muted-foreground">
                      {tanggalPendek(r.tanggal)} · {jamWib(r.submittedAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "tabular shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                      tercapai
                        ? "bg-ok-fill text-ok-text"
                        : "bg-warn-fill text-warn-text",
                    )}
                  >
                    {persen(rasio)}
                  </span>
                </div>

                <p className="tabular text-base leading-6 font-bold tracking-tight">
                  {rupiahPenuh(gmv)}
                  <span className="ml-1.5 text-[11px] leading-[14px] font-medium text-muted-foreground">
                    / {rupiahRingkas(r.target)}
                  </span>
                </p>

                {r.catatan ? (
                  <p className="text-[11px] leading-[14px] text-muted-foreground">
                    {r.catatan}
                  </p>
                ) : null}

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  {jejak.length > 0 ? (
                    <p className="flex items-center gap-1 text-[11px] leading-[14px] font-semibold text-warn-text">
                      <PencilLine className="size-3" />
                      {jejak.length} revisi tercatat
                    </p>
                  ) : (
                    <span className="text-[11px] leading-[14px] text-ok-text">
                      Terkirim
                    </span>
                  )}
                  <DialogRevisi
                    laporan={{ ...r, gmv }}
                    jejak={jejak}
                    olehNama={olehNama}
                    onSimpan={simpanRevisi}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {jumlahRevisi > 0 ? (
        <p className="text-[11px] leading-[14px] text-muted-foreground">
          {jumlahRevisi} revisi tercatat pada rentang ini. Setiap perubahan
          angka GMV meninggalkan jejak siapa, kapan, dan dari berapa ke berapa.
        </p>
      ) : null}
    </div>
  );
}
