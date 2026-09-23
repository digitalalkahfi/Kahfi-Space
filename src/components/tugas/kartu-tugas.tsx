"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  ShieldCheck,
  Target,
  Undo2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { jamWib, tanggalRelatif } from "@/lib/format";
import { periksaTugas, ubahStatusTugas } from "@/app/actions/tugas";
import { JejakPemeriksaan } from "@/components/tugas/jejak-qc";
import type { JejakQc } from "@/lib/data/tugas";
import type { Prioritas, StatusTugas, Tugas } from "@/lib/types";

const GAYA_PRIORITAS: Record<
  Prioritas,
  { kartu: string; teks: string; label: string }
> = {
  tinggi: {
    kartu: "bg-danger-fill",
    teks: "text-danger-text",
    label: "Prioritas tinggi",
  },
  sedang: {
    kartu: "bg-info-fill",
    teks: "text-info-text",
    label: "Prioritas sedang",
  },
  rendah: {
    kartu: "bg-accentmuted-fill",
    teks: "text-accentmuted-text",
    label: "Prioritas rendah",
  },
};

const LABEL_STATUS: Record<StatusTugas, string> = {
  todo: "Belum dikerjakan",
  berjalan: "Sedang dikerjakan",
  menunggu_qc: "Menunggu pemeriksaan",
  selesai: "Selesai",
};

/** Langkah berikutnya yang wajar dari sebuah status. */
function langkahBerikut(status: StatusTugas) {
  if (status === "todo")
    return { ke: "berjalan" as const, label: "Mulai kerjakan" };
  if (status === "berjalan")
    return { ke: "menunggu_qc" as const, label: "Ajukan pemeriksaan" };
  return null;
}

/**
 * Langkah mundur: membatalkan yang tadi terlanjur ditekan.
 *
 * Ada karena papan Kanban memungkinkannya lewat seretan (migrasi Fase 4),
 * dan yang bisa dilakukan dengan menyeret harus bisa dilakukan juga
 * dengan tombol — kalau tidak, orang yang tidak memakai tetikus
 * kehilangan satu kemampuan.
 */
function langkahMundur(status: StatusTugas) {
  if (status === "berjalan")
    return { ke: "todo" as const, label: "Kembalikan ke To Do" };
  if (status === "menunggu_qc")
    return { ke: "berjalan" as const, label: "Batalkan pengajuan" };
  return null;
}

/**
 * Satu tugas dengan aksi yang sesuai perannya: penerima menggeser status,
 * pemberi tugas memutuskan hasil QC. Database menolak bila tertukar.
 */
export function KartuTugas({
  tugas,
  sayaPenerima,
  bolehQc,
  hariIni,
  jejakQc = [],
  hasilTerbukaAwal = false,
}: {
  tugas: Tugas;
  sayaPenerima: boolean;
  /** Pemberi tugas atau atasan penerima. */
  bolehQc: boolean;
  hariIni: string;
  /** Riwayat pemeriksaan tugas ini, bila pernah diperiksa. */
  jejakQc?: JejakQc[];
  /**
   * Buka kolom hasil kerja sejak awal. Dipakai papan Kanban saat kartu
   * diseret ke kolom Review: syaratnya sama dengan tombol "Ajukan
   * pemeriksaan", jadi kolomnya yang dibuka, bukan aturannya yang diubah.
   */
  hasilTerbukaAwal?: boolean;
}) {
  const [sibuk, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusTugas>(tugas.status);
  const [qc, setQc] = useState(tugas.qcStatus);
  const [catatanQc, setCatatanQc] = useState("");
  const [isiCatatan, setIsiCatatan] = useState(false);
  const [hasilKerja, setHasilKerja] = useState(tugas.hasilKerja);
  const [isiHasil, setIsiHasil] = useState(hasilTerbukaAwal);

  const gaya = GAYA_PRIORITAS[tugas.prioritas];
  const berikut = langkahBerikut(status);
  const mundur = langkahMundur(status);
  const telat =
    tugas.tenggat &&
    status !== "selesai" &&
    new Date(tugas.tenggat) < new Date(`${hariIni}T23:59:59+07:00`) &&
    tugas.tenggat.slice(0, 10) < hariIni;

  const geser = (ke: "todo" | "berjalan" | "menunggu_qc") => {
    // Mengajukan pemeriksaan butuh keterangan hasil lebih dulu.
    if (ke === "menunggu_qc" && !isiHasil) {
      setIsiHasil(true);
      return;
    }

    mulai(async () => {
      const hasil = await ubahStatusTugas(
        tugas.id,
        ke,
        ke === "menunggu_qc" ? hasilKerja : undefined,
      );
      if (hasil.ok || hasil.kode === "demo") {
        setStatus(ke);
        setIsiHasil(false);
      }
      setPesan(hasil.ok ? null : hasil.pesan);
    });
  };

  const putuskan = (hasilQc: "lolos" | "revisi") =>
    mulai(async () => {
      const r = await periksaTugas(tugas.id, hasilQc, catatanQc);
      if (r.ok || r.kode === "demo") {
        setQc(hasilQc);
        setStatus(hasilQc === "lolos" ? "selesai" : "berjalan");
        setIsiCatatan(false);
        setCatatanQc("");
      }
      setPesan(r.ok ? null : r.pesan);
    });

  return (
    <Card className="kartu-interaktif rounded-2xl shadow-card ring-border-subtle">
      <div className={cn("mx-(--card-spacing) rounded-2xl p-3.5", gaya.kartu)}>
        {/* Dibungkus wrap: di kolom papan yang sempit, tenggat turun ke
            barisnya sendiri alih-alih memeras judul jadi satu kata per
            baris. Di daftar yang lebar keduanya tetap sebaris. */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-[10rem] flex-1">
            <p
              className={cn(
                "text-sm leading-5 font-semibold text-pretty",
                status === "selesai" && "text-muted-foreground line-through",
              )}
            >
              {tugas.judul}
            </p>
            {tugas.deskripsi ? (
              <p className="mt-1 text-[13px] leading-[18px] text-pretty text-muted-foreground">
                {tugas.deskripsi}
              </p>
            ) : null}
          </div>

          {tugas.tenggat ? (
            <span
              className={cn(
                "tabular flex shrink-0 items-center gap-1 text-[11px] leading-[14px] font-medium",
                telat ? "text-danger-text" : "text-muted-foreground",
              )}
            >
              <Clock className="size-3" />
              {tanggalRelatif(tugas.tenggat, hariIni)} {jamWib(tugas.tenggat)}
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full bg-card px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
              gaya.teks,
            )}
          >
            {tugas.label || gaya.label}
          </span>
          <span className="rounded-full bg-card px-2 py-0.5 text-[11px] leading-[14px] font-medium text-muted-foreground">
            {LABEL_STATUS[status]}
          </span>
          {qc === "lolos" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ok-fill px-2 py-0.5 text-[11px] leading-[14px] font-semibold text-ok-text">
              <ShieldCheck className="size-3" />
              Lolos QC
            </span>
          ) : null}
          {qc === "revisi" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warn-fill px-2 py-0.5 text-[11px] leading-[14px] font-semibold text-warn-text">
              <Undo2 className="size-3" />
              Minta revisi
            </span>
          ) : null}
          {tugas.tipe === "komitmen_mingguan" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] leading-[14px] font-semibold text-primary-foreground">
              <Target className="size-3" />
              Komitmen mingguan
            </span>
          ) : null}
          <span className="text-[11px] leading-[14px] text-muted-foreground">
            {sayaPenerima ? `Dari ${tugas.pembuat}` : `PIC ${tugas.penerima}`}
          </span>
          {status === "selesai" && tugas.selesaiPada ? (
            <span className="tabular text-[11px] leading-[14px] text-ok-text">
              Selesai {tanggalRelatif(tugas.selesaiPada, hariIni)}{" "}
              {jamWib(tugas.selesaiPada)}
            </span>
          ) : null}
        </div>
      </div>

      {tugas.goalJudul ? (
        <p className="flex items-start gap-1.5 px-(--card-spacing) text-[11px] leading-[14px] text-muted-foreground">
          <Target className="mt-px size-3 shrink-0" />
          <span className="text-pretty">
            Terhubung goal:{" "}
            <span className="font-semibold text-foreground">
              {tugas.goalJudul}
            </span>
            {tugas.goalPeriode ? ` · ${tugas.goalPeriode}` : ""}
          </span>
        </p>
      ) : null}

      <div className="space-y-2 px-(--card-spacing)">
        {sayaPenerima && berikut ? (
          isiHasil ? (
            <div className="space-y-2">
              <label
                htmlFor={`hasil-${tugas.id}`}
                className="block text-[11px] leading-[14px] font-semibold"
              >
                Apa yang sudah kamu kerjakan?
              </label>
              <textarea
                id={`hasil-${tugas.id}`}
                rows={2}
                value={hasilKerja}
                onChange={(e) => setHasilKerja(e.target.value)}
                placeholder="Mis. 12 video sudah diverifikasi, 3 perlu ganti thumbnail."
                className="w-full resize-none rounded-xl bg-muted px-3 py-2 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={sibuk}
                  onClick={() => setIsiHasil(false)}
                  className="tekan-halus h-8 flex-1 rounded-full text-[11px] font-semibold"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={sibuk || hasilKerja.trim().length < 5}
                  onClick={() => geser("menunggu_qc")}
                  className="tekan-halus h-8 flex-1 rounded-full text-[11px] font-semibold"
                >
                  {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Kirim untuk diperiksa
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={sibuk}
              onClick={() => geser(berikut.ke)}
              className="tekan-halus h-9 w-full rounded-full text-[11px] font-semibold"
            >
              {sibuk ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              {berikut.label}
            </Button>
          )
        ) : null}

        {sayaPenerima && mundur && !isiHasil ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={sibuk}
            onClick={() => geser(mundur.ke)}
            className="tekan-halus h-8 w-full rounded-full text-[11px] font-semibold"
          >
            <Undo2 className="size-3.5" />
            {mundur.label}
          </Button>
        ) : null}

        {status === "menunggu_qc" && hasilKerja ? (
          <p className="rounded-xl bg-muted/70 px-3 py-2 text-[11px] leading-[14px]">
            <span className="font-semibold">Hasil dari {tugas.penerima}: </span>
            {hasilKerja}
          </p>
        ) : null}

        {bolehQc && status === "menunggu_qc" ? (
          isiCatatan ? (
            <div className="space-y-2">
              <textarea
                rows={2}
                value={catatanQc}
                onChange={(e) => setCatatanQc(e.target.value)}
                placeholder="Apa yang perlu diperbaiki?"
                className="w-full resize-none rounded-xl bg-muted px-3 py-2 text-[13px] leading-[18px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={sibuk}
                  onClick={() => setIsiCatatan(false)}
                  className="tekan-halus h-8 flex-1 rounded-full text-[11px] font-semibold"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={sibuk || catatanQc.trim().length < 5}
                  onClick={() => putuskan("revisi")}
                  className="tekan-halus h-8 flex-1 rounded-full text-[11px] font-semibold"
                >
                  Kirim revisi
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={sibuk}
                onClick={() => putuskan("lolos")}
                className="tekan-halus h-9 flex-1 rounded-full text-[11px] font-semibold"
              >
                <CheckCircle2 className="size-3.5" />
                Luluskan
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={sibuk}
                onClick={() => setIsiCatatan(true)}
                className="tekan-halus h-9 flex-1 rounded-full text-[11px] font-semibold"
              >
                <Undo2 className="size-3.5" />
                Minta revisi
              </Button>
            </div>
          )
        ) : null}

        {tugas.qcNote && qc === "revisi" ? (
          <p className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text">
            Catatan pemeriksa: {tugas.qcNote}
          </p>
        ) : null}

        <JejakPemeriksaan jejak={jejakQc} />

        {pesan ? (
          <p
            role="status"
            className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text"
          >
            {pesan}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
