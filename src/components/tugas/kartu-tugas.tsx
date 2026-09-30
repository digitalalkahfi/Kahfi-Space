"use client";

import { useState, useTransition } from "react";
import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gauge,
  Loader2,
  ShieldCheck,
  Target,
  Undo2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  jamWib,
  keJamWib,
  keTanggalWib,
  tanggalKalenderPendek,
  tanggalKalenderRelatif,
} from "@/lib/format";
import {
  periksaTugas,
  ubahCentangToDo,
  ubahStatusTugas,
  ubahTenggatTugas,
} from "@/app/actions/tugas";
import { JejakPemeriksaan } from "@/components/tugas/jejak-qc";
import type { JejakQc } from "@/lib/data/tugas";
import type { Penanda } from "@/lib/papan-tanggal";
import type { Prioritas, StatusTugas, TipeTugas, Tugas } from "@/lib/types";

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

/** Nama jenis yang tampil di kartu; komitmen punya lencananya sendiri. */
const NAMA_TIPE: Record<TipeTugas, string> = {
  pribadi: "To-do",
  tiket: "Tiket",
  komitmen_mingguan: "Komitmen",
};

/**
 * Langkah berikutnya yang wajar dari sebuah status.
 *
 * To-do pribadi tidak diajukan ke pemeriksaan (D2): dari "Sedang
 * dikerjakan" ia cukup dicentang.
 */
function langkahBerikut(status: StatusTugas, tipe: TipeTugas) {
  if (status === "todo")
    return { ke: "berjalan" as const, label: "Mulai kerjakan" };
  if (status === "berjalan" && tipe !== "pribadi")
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
 * pemberi tugas memutuskan hasil QC dan mengatur tenggatnya. Database
 * menolak bila tertukar.
 */
export function KartuTugas({
  tugas,
  sayaPenerima,
  sayaPembuat,
  bolehQc,
  hariIni,
  jejakQc = [],
  hasilTerbukaAwal = false,
  penanda = null,
}: {
  tugas: Tugas;
  sayaPenerima: boolean;
  /** Pemberi tiket — satu-satunya yang boleh mengubah isinya (D1). */
  sayaPembuat: boolean;
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
  /**
   * Tanda di papan hari ini: tugas terlambat yang ikut naik ke hari ini,
   * atau tiket lama tanpa tenggat.
   */
  penanda?: Penanda;
}) {
  const [sibuk, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusTugas>(tugas.status);
  const [qc, setQc] = useState(tugas.qcStatus);
  const [catatanQc, setCatatanQc] = useState("");
  const [isiCatatan, setIsiCatatan] = useState(false);
  const [hasilKerja, setHasilKerja] = useState(tugas.hasilKerja);
  const [isiHasil, setIsiHasil] = useState(hasilTerbukaAwal);
  const [isiTenggat, setIsiTenggat] = useState(false);
  const [kriteriaTerbuka, setKriteriaTerbuka] = useState(false);
  const [tanggalBaru, setTanggalBaru] = useState("");
  const [jamBaru, setJamBaru] = useState("");

  const todo = tugas.tipe === "pribadi";
  const gaya = GAYA_PRIORITAS[tugas.prioritas];
  const berikut = langkahBerikut(status, tugas.tipe);
  const mundur = langkahMundur(status);

  const tanggalTenggat = tugas.tenggat ? keTanggalWib(tugas.tenggat) : "";
  const telat =
    tanggalTenggat !== "" && status !== "selesai" && tanggalTenggat < hariIni;
  // To-do tanpa jam tersimpan 23:59 WIB; yang ditampilkan tanggalnya saja.
  const labelTenggat = tugas.tenggat
    ? `${tanggalKalenderRelatif(tanggalTenggat, hariIni)}${
        tugas.tanpaJam ? "" : ` ${jamWib(tugas.tenggat)}`
      }`
    : "";

  // Menjadwal ulang: to-do oleh pemiliknya, tiket oleh pemberinya (D1).
  const bolehUbahTenggat =
    (todo ? sayaPenerima : sayaPembuat) && status !== "selesai";
  const namaTipe = NAMA_TIPE[tugas.tipe];
  const labelTarget =
    tugas.targetAngka !== null
      ? `${tugas.targetAngka.toLocaleString("id-ID", {
          maximumFractionDigits: 2,
        })} ${tugas.targetSatuan}`
      : "";
  // Kriteria panjang dipotong dua baris; tombolnya hanya muncul bila
  // memang ada yang terpotong.
  const kriteriaPanjang = tugas.kriteriaSelesai.length > 90;
  const labelKonteks =
    tugas.label && tugas.label !== namaTipe ? tugas.label : gaya.label;

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

  const centang = (selesai: boolean) =>
    mulai(async () => {
      const hasil = await ubahCentangToDo(tugas.id, selesai);
      if (hasil.ok || hasil.kode === "demo") {
        setStatus(selesai ? "selesai" : "todo");
      }
      setPesan(hasil.ok ? null : hasil.pesan);
    });

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

  const bukaUbahTenggat = () => {
    // Tenggat yang sudah lewat tidak bisa dipilih lagi; isian dimulai dari
    // hari ini supaya langsung sah.
    setTanggalBaru(
      tanggalTenggat && tanggalTenggat >= hariIni ? tanggalTenggat : hariIni,
    );
    setJamBaru(
      tugas.tenggat && !tugas.tanpaJam
        ? keJamWib(tugas.tenggat)
        : todo
          ? ""
          : "17:00",
    );
    setPesan(null);
    setIsiTenggat(true);
  };

  const simpanTenggat = () =>
    mulai(async () => {
      const hasil = await ubahTenggatTugas(
        tugas.id,
        tanggalBaru,
        jamBaru || null,
      );
      if (hasil.ok) setIsiTenggat(false);
      setPesan(hasil.ok ? null : hasil.pesan);
    });

  return (
    <Card className="kartu-interaktif rounded-2xl shadow-card ring-border-subtle">
      <div className={cn("mx-(--card-spacing) rounded-2xl p-3.5", gaya.kartu)}>
        {penanda?.jenis === "terlambat" ? (
          <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-danger px-2 py-0.5 text-[11px] leading-[14px] font-semibold text-white">
            <AlarmClock className="size-3" />
            Terlambat · {tanggalKalenderPendek(penanda.tanggal, hariIni)}
          </p>
        ) : null}
        {penanda?.jenis === "tanpa_tenggat" ? (
          <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] leading-[14px] font-semibold text-muted-foreground ring-1 ring-border-subtle">
            <Clock className="size-3" />
            Tanpa tenggat
          </p>
        ) : null}
        {/* Dibungkus wrap: di kolom papan yang sempit, tenggat turun ke
            barisnya sendiri alih-alih memeras judul jadi satu kata per
            baris. Di daftar yang lebar keduanya tetap sebaris. */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-[10rem] flex-1 items-start gap-2.5">
            {todo && sayaPenerima ? (
              <Checkbox
                checked={status === "selesai"}
                disabled={sibuk}
                onCheckedChange={(v) => centang(v === true)}
                aria-label={
                  status === "selesai"
                    ? `Buka lagi to-do ${tugas.judul}`
                    : `Tandai selesai: ${tugas.judul}`
                }
                className="mt-0.5 shrink-0 rounded-full bg-card"
              />
            ) : null}
            <div className="min-w-0 flex-1">
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
              {/* Saat menunggu QC, kriteria tampil utuh di atas hasil
                  kerja (di bawah); di sini cukup ringkasnya. */}
              {tugas.kriteriaSelesai && status !== "menunggu_qc" ? (
                <div className="mt-1.5 text-[12px] leading-[16px]">
                  <p
                    className={cn(
                      "text-pretty",
                      !kriteriaTerbuka && "line-clamp-2",
                    )}
                  >
                    <span className="font-semibold">Selesai bila: </span>
                    {tugas.kriteriaSelesai}
                  </p>
                  {kriteriaPanjang ? (
                    <button
                      type="button"
                      onClick={() => setKriteriaTerbuka(!kriteriaTerbuka)}
                      aria-expanded={kriteriaTerbuka}
                      className="tekan-halus mt-0.5 text-[11px] leading-[14px] font-semibold text-secondary hover:underline"
                    >
                      {kriteriaTerbuka ? "Ringkas" : "Selengkapnya"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {labelTenggat ? (
            <span
              className={cn(
                "tabular flex shrink-0 items-center gap-1 text-[11px] leading-[14px] font-medium",
                telat ? "text-danger-text" : "text-muted-foreground",
              )}
            >
              <Clock className="size-3" />
              {labelTenggat}
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {tugas.tipe !== "komitmen_mingguan" ? (
            <span className="rounded-full bg-card px-2 py-0.5 text-[11px] leading-[14px] font-semibold text-foreground ring-1 ring-border-subtle">
              {namaTipe}
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-full bg-card px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
              gaya.teks,
            )}
          >
            {labelKonteks}
          </span>
          <span className="rounded-full bg-card px-2 py-0.5 text-[11px] leading-[14px] font-medium text-muted-foreground">
            {LABEL_STATUS[status]}
          </span>
          {labelTarget ? (
            <span className="tabular inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] leading-[14px] font-semibold text-foreground">
              <Gauge className="size-3" />
              Target {labelTarget}
            </span>
          ) : null}
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
          {todo ? null : (
            <span className="text-[11px] leading-[14px] text-muted-foreground">
              {sayaPenerima ? `Dari ${tugas.pembuat}` : `PIC ${tugas.penerima}`}
            </span>
          )}
          {status === "selesai" && tugas.selesaiPada ? (
            <span className="tabular text-[11px] leading-[14px] text-ok-text">
              Selesai{" "}
              {tanggalKalenderRelatif(keTanggalWib(tugas.selesaiPada), hariIni)}{" "}
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

        {/* Pemeriksa menilai hasil terhadap kriteria yang disepakati di
            awal — jadi kriterianya dibaca lebih dulu (D5). */}
        {status === "menunggu_qc" && tugas.kriteriaSelesai ? (
          <div className="rounded-xl bg-info-fill px-3 py-2 text-[11px] leading-[14px] text-info-text">
            <p className="font-semibold">Kriteria selesai</p>
            <p className="mt-0.5 text-pretty">{tugas.kriteriaSelesai}</p>
            {labelTarget ? (
              <p className="tabular mt-0.5 font-semibold">
                Target: {labelTarget}
              </p>
            ) : null}
          </div>
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

        {bolehUbahTenggat ? (
          isiTenggat ? (
            <fieldset className="space-y-2 rounded-xl bg-muted/60 p-2.5">
              <legend className="sr-only">
                {todo ? "Pindahkan ke tanggal lain" : "Ubah tenggat"}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[11px] leading-[14px] font-semibold">
                  Tanggal
                  <input
                    type="date"
                    required
                    min={hariIni}
                    value={tanggalBaru}
                    onChange={(e) => setTanggalBaru(e.target.value)}
                    className="tabular h-9 w-full rounded-lg bg-card px-2 text-[13px] font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  />
                </label>
                <label className="space-y-1 text-[11px] leading-[14px] font-semibold">
                  {todo ? "Jam (opsional)" : "Jam"}
                  <input
                    type="time"
                    required={!todo}
                    value={jamBaru}
                    onChange={(e) => setJamBaru(e.target.value)}
                    className="tabular h-9 w-full rounded-lg bg-card px-2 text-[13px] font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={sibuk}
                  onClick={() => setIsiTenggat(false)}
                  className="tekan-halus h-8 flex-1 rounded-full text-[11px] font-semibold"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={sibuk || !tanggalBaru || (!todo && !jamBaru)}
                  onClick={simpanTenggat}
                  className="tekan-halus h-8 flex-1 rounded-full text-[11px] font-semibold"
                >
                  {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Simpan tanggal
                </Button>
              </div>
            </fieldset>
          ) : (
            <button
              type="button"
              onClick={bukaUbahTenggat}
              className="tekan-halus sentuh-nyaman flex w-full items-center gap-1.5 rounded-xl px-1 py-1 text-[11px] leading-[14px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <CalendarClock className="size-3" />
              {todo ? "Pindahkan ke tanggal lain" : "Ubah tenggat"}
            </button>
          )
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
