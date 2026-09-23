"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  PencilLine,
  TriangleAlert,
} from "lucide-react";
import { DialogRevisi } from "@/components/laporan-harian/dialog-revisi";
import { RekapKepatuhan } from "@/components/laporan-harian/rekap-kepatuhan";
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
import { KeadaanKosong } from "@/components/shared/keadaan";
import { cn } from "@/lib/utils";
import { GAYA_CAPAIAN, warnaCapaian } from "@/lib/capaian";
import { GAYA_MINIMUM, statusTerkirim } from "@/lib/batas-minimum";
import {
  bilangan,
  jamWib,
  persen,
  rasioCapaian,
  rupiahPenuh,
  rupiahRingkas,
  tanggalPendek,
} from "@/lib/format";
import type { LaporanHarian, RevisiLaporan } from "@/lib/types";

const SEMUA = "semua";

/** Angka satu laporan setelah koreksi yang belum sempat di-revalidate. */
type AngkaLaporan = {
  gmv: number;
  komisi: number | null;
  jumlahUpload: number | null;
};

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
  // Penyaring kedua, berdiri sendiri dari pilihan akun: Leader biasanya
  // ingin "semua akun, tapi hanya yang di bawah minimum".
  const [hanyaKurang, setHanyaKurang] = useState(false);
  // Koreksi yang baru saja disimpan agar angkanya langsung terlihat benar
  // sebelum halaman di-revalidate server.
  const [revisi, setRevisi] = useState<RevisiLaporan[]>([]);
  const [koreksi, setKoreksi] = useState<Record<string, AngkaLaporan>>({});

  const jejakUntuk = (id: string) =>
    revisi
      .filter((r) => r.reportId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const simpanRevisi = (baru: RevisiLaporan) => {
    setRevisi((s) => [...s, baru]);
    // Kolom yang tidak ikut berubah bernilai null di jejak; yang dipakai
    // tetap angka sebelumnya, bukan nol.
    setKoreksi((s) => {
      const lama = s[baru.reportId];
      const asal = riwayat.find((r) => r.id === baru.reportId);
      return {
        ...s,
        [baru.reportId]: {
          gmv: baru.gmvBaru,
          komisi: baru.komisiBaru ?? lama?.komisi ?? asal?.komisi ?? null,
          jumlahUpload:
            baru.uploadBaru ?? lama?.jumlahUpload ?? asal?.jumlahUpload ?? null,
        },
      };
    });
  };

  const angkaKini = (r: LaporanHarian): AngkaLaporan =>
    koreksi[r.id] ?? {
      gmv: r.gmv,
      komisi: r.komisi,
      jumlahUpload: r.jumlahUpload,
    };
  const gmvKini = (r: LaporanHarian) => angkaKini(r).gmv;

  // Kolom departemen hanya ditampilkan bila memang ada isinya di daftar
  // yang sedang dilihat — Leader MCN tidak perlu dua kolom kosong.
  const adaKomisi = riwayat.some((r) => angkaKini(r).komisi !== null);
  const adaUpload = riwayat.some((r) => angkaKini(r).jumlahUpload !== null);
  // Kolom "Min." menyusul kolom upload, dan hanya bila ada akun berlevel
  // di daftar ini — unit MCN & TAP tidak punya batas minimum sama sekali.
  const adaMinimum = riwayat.some((r) => r.minimumUpload !== null);

  const label = useMemo(
    () => Array.from(new Set(riwayat.map((r) => r.label))),
    [riwayat],
  );

  // Dipisah dari `daftar`: rekap di bawah membaca yang INI, bukan yang
  // sudah disaring "di bawah minimum". Kalau rekap ikut tersaring,
  // penyebutnya berubah jadi "0 dari 37" — benar secara aritmetika,
  // menyesatkan sebagai jawaban.
  const daftarAkun = useMemo(
    () =>
      (saringan === SEMUA
        ? riwayat
        : riwayat.filter((r) => r.label === saringan)
      )
        .slice()
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [riwayat, saringan],
  );

  const daftar = useMemo(
    () =>
      // Yang disaring hanya yang BISA dinilai: laporan unit dan akun
      // tanpa level tidak punya batas, jadi tidak pernah "di bawah".
      daftarAkun.filter(
        (r) =>
          !hanyaKurang ||
          statusTerkirim(angkaKini(r).jumlahUpload, r.minimumUpload) ===
            "kurang",
      ),
    // `koreksi` ikut jadi ketergantungan lewat angkaKini: laporan yang
    // baru saja diperbaiki harus langsung keluar dari saringan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [daftarAkun, hanyaKurang, koreksi],
  );

  // Kalau tidak ada satu pun yang di bawah minimum, tombolnya tetap ada
  // tapi hasilnya kosong — itu jawaban yang berguna, bukan kesalahan.
  const jumlahKurang = riwayat.filter(
    (r) =>
      statusTerkirim(angkaKini(r).jumlahUpload, r.minimumUpload) === "kurang",
  ).length;

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
      judul: "Komisi (Rp)",
      ambil: (r) => angkaKini(r).komisi ?? "",
      lebar: 16,
    },
    {
      judul: "Jumlah upload",
      ambil: (r) => angkaKini(r).jumlahUpload ?? "",
      lebar: 14,
    },
    {
      judul: "Min. upload",
      ambil: (r) => r.minimumUpload ?? "",
      lebar: 12,
    },
    {
      judul: "Status minimum",
      ambil: (r) => {
        const st = statusTerkirim(angkaKini(r).jumlahUpload, r.minimumUpload);
        return st === null ? "" : st === "terpenuhi" ? "Terpenuhi" : "Kurang";
      },
      lebar: 16,
    },
    {
      judul: "Revisi",
      ambil: (r) => Math.max(r.jumlahRevisi, jejakUntuk(r.id).length),
      lebar: 8,
    },
    { judul: "Catatan", ambil: (r) => r.catatan, lebar: 48 },
  ];

  const totalGmv = daftar.reduce((a, r) => a + gmvKini(r), 0);
  const totalKomisi = daftar.reduce(
    (a, r) => a + (angkaKini(r).komisi ?? 0),
    0,
  );
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
                "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
                l === saringan
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
              )}
            >
              {l === SEMUA ? "Semua akun" : l}
            </button>
          ))}

          {adaMinimum ? (
            <button
              type="button"
              onClick={() => setHanyaKurang((v) => !v)}
              aria-pressed={hanyaKurang}
              aria-label="Hanya laporan yang di bawah minimum"
              className={cn(
                "tekan-halus sentuh-nyaman flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
                hanyaKurang
                  ? "bg-warn-fill text-warn-text ring-1 ring-warn-text/20"
                  : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
              )}
            >
              <TriangleAlert className="size-3" aria-hidden />
              Di bawah minimum
              <span className="tabular opacity-70">({jumlahKurang})</span>
            </button>
          ) : null}
        </div>

        <TombolUnduhExcel
          baris={daftar}
          kolom={kolomEkspor}
          namaBerkas={namaBerkasTanggal(
            [
              saringan === SEMUA
                ? "k-space-laporan-harian"
                : `k-space-laporan-${saringan.replace(/[^a-z0-9]+/gi, "-")}`,
              // Berkas yang sudah disaring harus mengaku dari namanya;
              // kalau tidak, ia beredar sebagai "seluruh laporan".
              hanyaKurang ? "di-bawah-minimum" : "",
            ]
              .filter(Boolean)
              .join("-"),
          )}
          namaSheet="Laporan Harian"
        />
      </div>

      <div
        className={cn(
          "grid gap-3",
          adaKomisi ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
        )}
      >
        {[
          { label: "Laporan", nilai: String(daftar.length) },
          { label: "Total GMV", nilai: rupiahRingkas(totalGmv) },
          ...(adaKomisi
            ? [{ label: "Total komisi", nilai: rupiahRingkas(totalKomisi) }]
            : []),
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

      {daftar.length === 0 ? (
        <KeadaanKosong
          ikon={<CheckCircle2 className="size-4" />}
          judul={
            hanyaKurang
              ? "Tidak ada yang di bawah minimum"
              : "Belum ada laporan"
          }
          pesan={
            hanyaKurang
              ? "Semua laporan pada pilihan ini sudah memenuhi batas minimum levelnya. Matikan penyaringnya untuk melihat seluruh laporan."
              : "Belum ada laporan yang cocok dengan pilihan ini."
          }
        />
      ) : null}

      {/* Rekap ikut saringan & koreksi di atasnya, bukan riwayat mentah:
          angka yang baru saja diperbaiki harus langsung terhitung. */}
      <RekapKepatuhan
        riwayat={daftarAkun.map((r) => ({
          akunId: r.akunId,
          label: r.label,
          pelaporNama: r.pelaporNama,
          jumlahUpload: angkaKini(r).jumlahUpload,
          minimumUpload: r.minimumUpload,
        }))}
      />

      {/* Desktop: tabel padat */}
      <Card className="hidden rounded-3xl shadow-card ring-border-subtle lg:block">
        <div className="overflow-x-auto px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Akun / unit</TableHead>
                <TableHead className="text-right">GMV</TableHead>
                {adaKomisi ? (
                  <TableHead className="text-right">Komisi</TableHead>
                ) : null}
                {adaUpload ? (
                  <TableHead className="text-right">Upload</TableHead>
                ) : null}
                {adaMinimum ? (
                  <TableHead className="text-right">Min.</TableHead>
                ) : null}
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Capaian</TableHead>
                <TableHead>Status &amp; perbaikan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daftar.map((r) => {
                const angka = angkaKini(r);
                const gmv = angka.gmv;
                const rasio = rasioCapaian(gmv, r.target);
                const warna = warnaCapaian(rasio, r.target > 0);
                const statusUpload = statusTerkirim(
                  angka.jumlahUpload,
                  r.minimumUpload,
                );
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
                    {adaKomisi ? (
                      <TableCell className="tabular text-right whitespace-nowrap">
                        {angka.komisi === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          rupiahRingkas(angka.komisi)
                        )}
                      </TableCell>
                    ) : null}
                    {adaUpload ? (
                      <TableCell className="tabular text-right whitespace-nowrap">
                        {angka.jumlahUpload === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={cn(
                              "font-semibold",
                              statusUpload
                                ? GAYA_MINIMUM[statusUpload].teks
                                : undefined,
                            )}
                          >
                            {bilangan(angka.jumlahUpload)}
                          </span>
                        )}
                      </TableCell>
                    ) : null}
                    {adaMinimum ? (
                      <TableCell className="tabular text-right whitespace-nowrap text-muted-foreground">
                        {r.minimumUpload === null
                          ? "—"
                          : bilangan(r.minimumUpload)}
                      </TableCell>
                    ) : null}
                    <TableCell className="tabular text-right whitespace-nowrap text-muted-foreground">
                      {rupiahRingkas(r.target)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "tabular rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                          warna
                            ? GAYA_CAPAIAN[warna].pil
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {r.target > 0 ? persen(rasio) : "—"}
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
                          laporan={{ ...r, ...angka }}
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
          const angka = angkaKini(r);
          const gmv = angka.gmv;
          const rasio = rasioCapaian(gmv, r.target);
          const warna = warnaCapaian(rasio, r.target > 0);
          const statusUpload = statusTerkirim(
            angka.jumlahUpload,
            r.minimumUpload,
          );
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
                      warna
                        ? GAYA_CAPAIAN[warna].pil
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {r.target > 0 ? persen(rasio) : "—"}
                  </span>
                </div>

                <p className="tabular text-base leading-6 font-bold tracking-tight">
                  {rupiahPenuh(gmv)}
                  <span className="ml-1.5 text-[11px] leading-[14px] font-medium text-muted-foreground">
                    / {rupiahRingkas(r.target)}
                  </span>
                </p>

                {angka.komisi !== null || angka.jumlahUpload !== null ? (
                  <div className="flex flex-wrap gap-1.5">
                    {angka.komisi !== null ? (
                      <span className="tabular rounded-full bg-muted px-2 py-0.5 text-[11px] leading-[14px] font-semibold">
                        Komisi {rupiahRingkas(angka.komisi)}
                      </span>
                    ) : null}
                    {angka.jumlahUpload !== null ? (
                      <span
                        className={cn(
                          "tabular rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                          statusUpload
                            ? GAYA_MINIMUM[statusUpload].pil
                            : "bg-muted",
                        )}
                      >
                        {bilangan(angka.jumlahUpload)}
                        {r.minimumUpload === null
                          ? ""
                          : ` / ${bilangan(r.minimumUpload)} min.`}{" "}
                        upload
                      </span>
                    ) : null}
                  </div>
                ) : null}

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
                    laporan={{ ...r, ...angka }}
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
          {jumlahRevisi} revisi tercatat pada rentang ini. Setiap angka yang
          berubah meninggalkan jejak siapa, kapan, dan dari berapa ke berapa.
        </p>
      ) : null}
    </div>
  );
}
