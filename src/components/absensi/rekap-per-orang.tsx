"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, MapPinOff } from "lucide-react";
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
import {
  GAYA_STATUS_HARI,
  LABEL_STATUS_HARI,
  ringkasRekapOrang,
  urutkanRekapOrang,
  type HariKehadiranOrang,
  type RekapOrang,
} from "@/lib/rekap-kehadiran";

const SEMUA = "semua";

const jam = (iso: string | null) =>
  iso ? jamWib(iso).replace(" WIB", "") : "—";

type BarisHari = HariKehadiranOrang & { nama: string; unit: string };

/**
 * Rekap kehadiran per orang: siapa hadir, siapa tidak, dan keterangannya.
 *
 * Satu baris satu orang dengan jumlahnya; hari demi harinya dibuka di
 * tempat, bukan di halaman lain — pertanyaan "kenapa dia 70%?" harus
 * terjawab tanpa berpindah layar.
 */
export function RekapPerOrang({
  daftar,
  bolehLihatTim,
}: {
  daftar: RekapOrang[];
  /** Menentukan saringan unit dan sebutan ringkasannya. */
  bolehLihatTim: boolean;
}) {
  const [saringan, setSaringan] = useState<string>(SEMUA);
  const [terbuka, setTerbuka] = useState<string | null>(null);

  const opsi = useMemo(
    () => [SEMUA, ...Array.from(new Set(daftar.map((o) => o.unit)))],
    [daftar],
  );

  const tampil = useMemo(
    () =>
      urutkanRekapOrang(
        saringan === SEMUA ? daftar : daftar.filter((o) => o.unit === saringan),
      ),
    [daftar, saringan],
  );

  const ringkas = ringkasRekapOrang(tampil);

  const kolomOrang: KolomEkspor<RekapOrang>[] = [
    { judul: "Nama", ambil: (o) => o.nama, lebar: 22 },
    { judul: "Unit", ambil: (o) => o.unit, lebar: 16 },
    { judul: "Peran", ambil: (o) => o.role, lebar: 12 },
    {
      judul: "Wajib absen",
      ambil: (o) => (o.wajibAbsen ? "Ya" : "Tidak"),
      lebar: 12,
    },
    { judul: "Hari kerja", ambil: (o) => o.jumlah.hariKerja, lebar: 11 },
    {
      judul: "Hadir",
      ambil: (o) => o.jumlah.hadir + o.jumlah.terlambat,
      lebar: 9,
    },
    { judul: "Terlambat", ambil: (o) => o.jumlah.terlambat, lebar: 11 },
    { judul: "Izin", ambil: (o) => o.jumlah.izin, lebar: 8 },
    { judul: "Sakit", ambil: (o) => o.jumlah.sakit, lebar: 8 },
    {
      judul: "Tanpa keterangan",
      ambil: (o) => o.jumlah.tanpaKeterangan,
      lebar: 17,
    },
    {
      judul: "% Hadir",
      ambil: (o) => (o.persenHadir === null ? "" : Math.round(o.persenHadir)),
      lebar: 9,
    },
    { judul: "Menit telat", ambil: (o) => o.totalMenitTelat, lebar: 11 },
  ];

  const barisHari: BarisHari[] = tampil.flatMap((o) =>
    o.hari.map((h) => ({ ...h, nama: o.nama, unit: o.unit })),
  );

  const kolomHari: KolomEkspor<BarisHari>[] = [
    { judul: "Tanggal", ambil: (h) => h.tanggal, lebar: 12 },
    { judul: "Nama", ambil: (h) => h.nama, lebar: 22 },
    { judul: "Unit", ambil: (h) => h.unit, lebar: 16 },
    { judul: "Status", ambil: (h) => LABEL_STATUS_HARI[h.status], lebar: 18 },
    { judul: "Jam masuk", ambil: (h) => jam(h.jamMasuk), lebar: 12 },
    { judul: "Jam pulang", ambil: (h) => jam(h.jamPulang), lebar: 12 },
    { judul: "Menit telat", ambil: (h) => h.menitTelat, lebar: 12 },
    {
      judul: "Lokasi valid",
      ambil: (h) => (h.jamMasuk ? (h.lokasiValid ? "Ya" : "Tidak") : "—"),
      lebar: 12,
    },
    {
      judul: "Persetujuan",
      ambil: (h) => h.persetujuan ?? "",
      lebar: 12,
    },
    { judul: "Keterangan", ambil: (h) => h.alasan, lebar: 40 },
  ];

  const kartu = [
    bolehLihatTim
      ? { label: "Wajib absen", nilai: `${ringkas.wajib} orang` }
      : { label: "Hari dinilai", nilai: `${ringkas.hariKerja} hari` },
    {
      label: "Rata-rata hadir",
      nilai: ringkas.rataHadir === null ? "—" : persen(ringkas.rataHadir, 0),
    },
    { label: "Tanpa keterangan", nilai: `${ringkas.tanpaKeterangan} hari` },
    { label: "Terlambat", nilai: `${ringkas.terlambat} kali` },
  ];

  const namaBerkas = bolehLihatTim ? "kehadiran-tim" : "kehadiran-saya";

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

        <div className="flex flex-wrap items-center gap-2">
          <TombolUnduhExcel
            baris={tampil}
            kolom={kolomOrang}
            namaBerkas={namaBerkasTanggal(`k-space-${namaBerkas}-per-orang`)}
            namaSheet="Per orang"
            label="Unduh per orang"
          />
          <TombolUnduhExcel
            baris={barisHari}
            kolom={kolomHari}
            namaBerkas={namaBerkasTanggal(`k-space-${namaBerkas}-harian`)}
            namaSheet="Harian"
            label="Unduh harian"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kartu.map((k) => (
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

      <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
        Hari kerja Senin–Sabtu di luar libur perusahaan, dihitung sejak absen
        pertama tiap orang. Izin dan sakit yang disetujui tidak mengurangi
        persen hadir. CEO, Manager, dan Finance tidak wajib absen; catatan
        mereka tampil bila ada, tanpa ditagih.
      </p>

      {/* Desktop: tabel; HP & tablet: kartu bertumpuk */}
      <Card className="hidden rounded-3xl shadow-card ring-border-subtle lg:block">
        <div className="overflow-x-auto px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="text-right">Hari kerja</TableHead>
                <TableHead className="text-right">Hadir</TableHead>
                <TableHead className="text-right">Terlambat</TableHead>
                <TableHead className="text-right">Izin</TableHead>
                <TableHead className="text-right">Sakit</TableHead>
                <TableHead className="text-right">Tanpa ket.</TableHead>
                <TableHead className="text-right">% Hadir</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tampil.map((o) => {
                const buka = terbuka === o.id;
                return (
                  <Fragment key={o.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setTerbuka(buka ? null : o.id)}
                    >
                      <TableCell>
                        <span className="block font-medium">{o.nama}</span>
                        <span className="block text-[11px] leading-[14px] text-muted-foreground">
                          {o.unit} · {o.role}
                          {o.wajibAbsen ? "" : " · tidak wajib absen"}
                        </span>
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {o.jumlah.hariKerja}
                      </TableCell>
                      <TableCell className="tabular text-right text-ok-text">
                        {o.jumlah.hadir + o.jumlah.terlambat}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {o.jumlah.terlambat}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {o.jumlah.izin}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {o.jumlah.sakit}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "tabular text-right font-semibold",
                          o.jumlah.tanpaKeterangan > 0
                            ? "text-danger-text"
                            : "text-muted-foreground",
                        )}
                      >
                        {o.jumlah.tanpaKeterangan}
                      </TableCell>
                      <TableCell className="tabular text-right font-semibold">
                        {o.persenHadir === null
                          ? "—"
                          : persen(o.persenHadir, 0)}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          aria-expanded={buka}
                          aria-label={`Hari demi hari ${o.nama}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTerbuka(buka ? null : o.id);
                          }}
                          className="tekan-halus flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                        >
                          <ChevronDown
                            className={cn(
                              "size-4 transition-transform",
                              buka && "rotate-180",
                            )}
                          />
                        </button>
                      </TableCell>
                    </TableRow>
                    {buka ? (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/40">
                          <DaftarHari hari={o.hari} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="space-y-2.5 lg:hidden">
        {tampil.map((o) => {
          const buka = terbuka === o.id;
          return (
            <Card
              key={o.id}
              className="rounded-2xl shadow-card ring-border-subtle"
            >
              <button
                type="button"
                aria-expanded={buka}
                onClick={() => setTerbuka(buka ? null : o.id)}
                className="flex w-full items-center gap-3 px-4 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-[18px] font-semibold">
                    {o.nama}
                  </span>
                  <span className="tabular block text-[11px] leading-[14px] text-muted-foreground">
                    {o.unit} · {o.jumlah.hadir + o.jumlah.terlambat}/
                    {o.jumlah.hariKerja} hari hadir
                    {o.jumlah.tanpaKeterangan > 0
                      ? ` · ${o.jumlah.tanpaKeterangan} tanpa keterangan`
                      : ""}
                    {o.wajibAbsen ? "" : " · tidak wajib absen"}
                  </span>
                </span>
                <span
                  className={cn(
                    "tabular shrink-0 text-base leading-6 font-bold",
                    o.jumlah.tanpaKeterangan > 0 && "text-danger-text",
                  )}
                >
                  {o.persenHadir === null ? "—" : persen(o.persenHadir, 0)}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    buka && "rotate-180",
                  )}
                />
              </button>
              {buka ? (
                <div className="px-4">
                  <DaftarHari hari={o.hari} />
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/** Hari demi hari seseorang, terbaru dulu. */
function DaftarHari({ hari }: { hari: HariKehadiranOrang[] }) {
  return (
    <ul className="grid gap-1.5 py-1 sm:grid-cols-2 xl:grid-cols-3">
      {hari.map((h) => (
        <li
          key={h.tanggal}
          className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 ring-1 ring-border-subtle"
        >
          <span className="tabular w-14 shrink-0 text-[11px] leading-[14px] text-muted-foreground">
            {tanggalPendek(h.tanggal)}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
              GAYA_STATUS_HARI[h.status],
            )}
          >
            {LABEL_STATUS_HARI[h.status]}
          </span>
          <span className="tabular min-w-0 flex-1 truncate text-[11px] leading-[14px] text-muted-foreground">
            {h.jamMasuk ? `${jam(h.jamMasuk)} – ${jam(h.jamPulang)}` : ""}
            {h.menitTelat > 0 ? ` · telat ${h.menitTelat} mnt` : ""}
            {h.izinSelesai ? ` · izin s.d. ${h.izinSelesai.slice(0, 5)}` : ""}
            {h.persetujuan === "diajukan" ? " · menunggu persetujuan" : ""}
            {h.persetujuan === "ditolak" ? " · izin ditolak" : ""}
            {h.alasan ? ` · ${h.alasan}` : ""}
          </span>
          {h.jamMasuk && !h.lokasiValid ? (
            <MapPinOff
              aria-label="Di luar radius"
              className="size-3.5 shrink-0 text-danger-text"
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
