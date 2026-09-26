"use client";

import { useMemo, useState } from "react";
import { MapPinOff, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TombolUnduhExcel } from "@/components/shared/tombol-unduh-excel";
import { namaBerkasTanggal, type KolomEkspor } from "@/lib/ekspor-excel";
import { cn } from "@/lib/utils";
import { jamWib, persen, tanggalPendek } from "@/lib/format";
import type { BarisRekapAbsensi } from "@/lib/data/absensi";
import type { StatusAbsen } from "@/lib/types";

const LABEL: Record<StatusAbsen, string> = {
  hadir: "Hadir",
  terlambat: "Terlambat",
  izin: "Izin",
  sakit: "Sakit",
  belum_absen: "Belum absen",
};

const WARNA: Record<StatusAbsen, string> = {
  hadir: "bg-ok-fill text-ok-text",
  terlambat: "bg-warn-fill text-warn-text",
  izin: "bg-info-fill text-info-text",
  sakit: "bg-info-fill text-info-text",
  belum_absen: "bg-danger-fill text-danger-text",
};

const SEMUA = "semua";

/** Rekap kehadiran dengan saringan sederhana dan unduhan Excel. */
export function TabelRekapAbsensi({
  baris,
  bolehLihatTim,
}: {
  baris: BarisRekapAbsensi[];
  /** Menentukan apakah kolom nama & saringan unit ditampilkan. */
  bolehLihatTim: boolean;
}) {
  const [saringan, setSaringan] = useState<string>(SEMUA);

  const opsi = useMemo(
    () => [SEMUA, ...Array.from(new Set(baris.map((b) => b.unit)))],
    [baris],
  );

  const daftar = useMemo(
    () =>
      saringan === SEMUA ? baris : baris.filter((b) => b.unit === saringan),
    [baris, saringan],
  );

  const hadir = daftar.filter(
    (b) => b.status === "hadir" || b.status === "terlambat",
  ).length;
  const telat = daftar.filter((b) => b.terlambat).length;
  const diLuarRadius = daftar.filter(
    (b) => !b.lokasiValid && b.jamMasuk !== null,
  ).length;

  const kolom: KolomEkspor<BarisRekapAbsensi>[] = [
    { judul: "Tanggal", ambil: (b) => b.tanggal, lebar: 12 },
    ...(bolehLihatTim
      ? ([
          { judul: "Nama", ambil: (b) => b.nama, lebar: 22 },
          { judul: "Unit", ambil: (b) => b.unit, lebar: 16 },
        ] as KolomEkspor<BarisRekapAbsensi>[])
      : []),
    { judul: "Status", ambil: (b) => LABEL[b.status], lebar: 14 },
    {
      judul: "Jam masuk",
      ambil: (b) => (b.jamMasuk ? jamWib(b.jamMasuk).replace(" WIB", "") : "—"),
      lebar: 12,
    },
    {
      judul: "Jam pulang",
      ambil: (b) =>
        b.jamPulang ? jamWib(b.jamPulang).replace(" WIB", "") : "—",
      lebar: 12,
    },
    {
      // Berapa kali catatan hari itu diulang (migrasi 0171).
      judul: "Absen ulang",
      ambil: (b) => b.ulangMasuk + b.ulangPulang,
      lebar: 11,
    },
    {
      judul: "Terlambat",
      ambil: (b) => (b.terlambat ? "Ya" : "Tidak"),
      lebar: 10,
    },
    {
      // Terhadap jam efektif masuk: yang izin berjamnya disetujui sudah
      // ikut diperhitungkan (migrasi 0132).
      judul: "Menit telat",
      ambil: (b) => b.menitTelat,
      lebar: 12,
    },
    {
      judul: "Izin s.d.",
      ambil: (b) => b.izinSelesai?.slice(0, 5) ?? "",
      lebar: 10,
    },
    {
      judul: "Lokasi valid",
      ambil: (b) => (b.jamMasuk ? (b.lokasiValid ? "Ya" : "Tidak") : "—"),
      lebar: 12,
    },
    {
      judul: "Jarak (m)",
      ambil: (b) => (b.jarakMeter === null ? "" : Number(b.jarakMeter)),
      lebar: 10,
    },
    {
      judul: "Laporan GMV",
      ambil: (b) => (b.sudahLapor ? "Terkirim" : "—"),
      lebar: 14,
    },
    { judul: "Alasan", ambil: (b) => b.alasan, lebar: 40 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {bolehLihatTim && opsi.length > 2 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {opsi.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setSaringan(o)}
                aria-pressed={o === saringan}
                className={cn(
                  "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold",
                  o === saringan
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
                )}
              >
                {o === SEMUA ? "Semua unit" : o}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}

        <TombolUnduhExcel
          baris={daftar}
          kolom={kolom}
          namaBerkas={namaBerkasTanggal(
            bolehLihatTim ? "k-space-absensi-tim" : "k-space-absensi-saya",
          )}
          namaSheet="Rekap Absensi"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Kehadiran", nilai: `${hadir}/${daftar.length}` },
          {
            label: "Terlambat",
            nilai: daftar.length
              ? persen((telat / daftar.length) * 100, 0)
              : "—",
          },
          { label: "Di luar radius", nilai: String(diLuarRadius) },
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

      {/* Desktop: tabel; HP & tablet: kartu bertumpuk */}
      <Card className="hidden rounded-3xl shadow-card ring-border-subtle lg:block">
        <div className="overflow-x-auto px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                {bolehLihatTim ? <TableHead>Nama</TableHead> : null}
                <TableHead>Status</TableHead>
                <TableHead>Masuk</TableHead>
                <TableHead>Pulang</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead>Laporan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daftar.map((b, i) => (
                <TableRow key={`${b.tanggal}-${b.nama}-${i}`}>
                  <TableCell className="whitespace-nowrap">
                    {tanggalPendek(b.tanggal)}
                  </TableCell>
                  {bolehLihatTim ? (
                    <TableCell>
                      <span className="block font-medium">{b.nama}</span>
                      <span className="block text-[11px] leading-[14px] text-muted-foreground">
                        {b.unit}
                      </span>
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                        WARNA[b.status],
                      )}
                    >
                      {LABEL[b.status]}
                    </span>
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap">
                    {b.jamMasuk ? jamWib(b.jamMasuk).replace(" WIB", "") : "—"}
                    {b.ulangMasuk > 0 ? (
                      <span className="block text-[10px] leading-[12px] text-warn-text">
                        diulang {b.ulangMasuk}×
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap">
                    {b.jamPulang
                      ? jamWib(b.jamPulang).replace(" WIB", "")
                      : "—"}
                    {b.ulangPulang > 0 ? (
                      <span className="block text-[10px] leading-[12px] text-warn-text">
                        diulang {b.ulangPulang}×
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {!b.jamMasuk ? (
                      <span className="text-muted-foreground">—</span>
                    ) : b.lokasiValid ? (
                      <span className="text-[11px] leading-[14px] text-ok-text">
                        Dalam radius
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] leading-[14px] font-semibold text-danger-text">
                        <MapPinOff className="size-3" />
                        Di luar radius
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-[11px] leading-[14px]">
                    {b.sudahLapor ? (
                      <span className="text-ok-text">Terkirim</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="space-y-2.5 lg:hidden">
        {daftar.map((b, i) => (
          <Card
            key={`${b.tanggal}-${b.nama}-${i}`}
            className="kartu-interaktif rounded-2xl shadow-card ring-border-subtle"
          >
            <div className="space-y-1.5 px-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {bolehLihatTim ? (
                    <p className="truncate text-[13px] leading-[18px] font-semibold">
                      {b.nama}
                    </p>
                  ) : null}
                  <p className="tabular text-[11px] leading-[14px] text-muted-foreground">
                    {tanggalPendek(b.tanggal)}
                    {bolehLihatTim ? ` · ${b.unit}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                    WARNA[b.status],
                  )}
                >
                  {LABEL[b.status]}
                </span>
              </div>

              <p className="tabular flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-[14px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {b.jamMasuk
                    ? jamWib(b.jamMasuk).replace(" WIB", "")
                    : "—"} –{" "}
                  {b.jamPulang ? jamWib(b.jamPulang).replace(" WIB", "") : "—"}
                </span>
                {b.jamMasuk && !b.lokasiValid ? (
                  <span className="flex items-center gap-1 font-semibold text-danger-text">
                    <MapPinOff className="size-3" />
                    Di luar radius
                  </span>
                ) : null}
                {b.sudahLapor ? (
                  <span className="text-ok-text">Laporan terkirim</span>
                ) : null}
                {b.ulangMasuk + b.ulangPulang > 0 ? (
                  <span className="text-warn-text">
                    Absen diulang {b.ulangMasuk + b.ulangPulang}×
                  </span>
                ) : null}
              </p>

              {b.alasan ? (
                <p className="text-[11px] leading-[14px] text-muted-foreground">
                  {b.alasan}
                </p>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
