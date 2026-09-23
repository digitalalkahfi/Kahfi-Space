"use client";

import { useState, useTransition } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  Stethoscope,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tanggalPanjang } from "@/lib/format";
import {
  batasTerencana,
  jumlahHari,
  LABEL_BENTUK,
  MAKS_ALASAN_IZIN,
  periksaIzin,
  type BentukIzin,
  type IsiIzin,
} from "@/lib/izin";
import { ajukanIzin } from "@/app/actions/absensi";

const BENTUK: BentukIzin[] = ["sakit", "terencana", "jam"];

/**
 * Pengajuan izin: sakit hari berjalan, izin terencana sehari atau lebih
 * (minimal H-1), atau izin beberapa jam pada hari berjalan.
 *
 * Keputusannya tetap di atasan (PRD §3) — form ini hanya mengirim, dan
 * memakai pemeriksaan yang sama persis dengan Server Action-nya supaya
 * tidak ada aturan yang hanya berlaku di satu sisi.
 */
export function FormIzin({ hariIni }: { hariIni: string }) {
  const besok = batasTerencana(hariIni);
  const [bentuk, setBentuk] = useState<BentukIzin>("sakit");
  const [mulai, setMulai] = useState(besok);
  const [selesai, setSelesai] = useState(besok);
  const [jamMulai, setJamMulai] = useState("08:00");
  const [jamSelesai, setJamSelesai] = useState("10:00");
  const [alasan, setAlasan] = useState("");
  const [mengirim, mulaiKirim] = useTransition();
  const [hasil, setHasil] = useState<{ ok: boolean; teks: string } | null>(
    null,
  );

  // Sakit dan izin berjam selalu hari berjalan; tanggalnya tidak dipilih.
  const tanggalMulai = bentuk === "terencana" ? mulai : hariIni;
  const isi: IsiIzin = {
    bentuk,
    mulai: tanggalMulai,
    selesai: bentuk === "terencana" ? selesai : tanggalMulai,
    jamMulai,
    jamSelesai,
    alasan,
  };
  const salah = periksaIzin(isi, hariIni);
  const hari = jumlahHari(isi.mulai, isi.selesai);
  // Form yang baru dibuka belum salah, hanya belum diisi — memerahkannya
  // sejak awal membuat peringatan yang sungguhan ikut diabaikan.
  const belumDiisi = alasan.trim().length === 0;
  const keliru = Boolean(salah) && !belumDiisi;

  const kirim = () => {
    if (salah || mengirim) return;
    setHasil(null);
    mulaiKirim(async () => {
      const r = await ajukanIzin({
        bentuk,
        mulai: isi.mulai,
        selesai: isi.selesai,
        jamMulai: isi.jamMulai,
        jamSelesai: isi.jamSelesai,
        alasan: isi.alasan,
      });
      setHasil({ ok: r.ok, teks: r.pesan ?? "Pengajuan terkirim." });
      if (r.ok) setAlasan("");
    });
  };

  if (hasil?.ok) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="space-y-2 px-5 py-2 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-fill text-ok-text">
            <CheckCircle2 className="size-6" />
          </span>
          <h2 className="text-base leading-6 font-semibold">
            Pengajuan terkirim
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {LABEL_BENTUK[bentuk].label}
            {bentuk === "jam"
              ? ` ${jamMulai}–${jamSelesai}`
              : hari > 1
                ? ` ${hari} hari`
                : ""}{" "}
            untuk {tanggalPanjang(isi.mulai)} menunggu persetujuan atasan.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setHasil(null)}
            className="tekan-halus h-10 rounded-full px-5 text-[13px] font-semibold"
          >
            Ajukan lagi
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">Ajukan izin</h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Atasan langsungmu yang memutuskan.
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info-fill text-info-text">
          <Stethoscope className="size-4" />
        </span>
      </div>

      <form
        className="space-y-4 px-5"
        onSubmit={(e) => {
          e.preventDefault();
          kirim();
        }}
      >
        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-[18px] font-semibold">
            Bentuk pengajuan
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {BENTUK.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBentuk(b)}
                aria-pressed={bentuk === b}
                className={cn(
                  "tekan-halus rounded-xl px-3 py-2.5 text-left",
                  bentuk === b
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="block text-[13px] leading-[18px] font-semibold">
                  {LABEL_BENTUK[b].label}
                </span>
                <span
                  className={cn(
                    "block text-[11px] leading-[14px]",
                    bentuk === b
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground",
                  )}
                >
                  {LABEL_BENTUK[b].keterangan}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {bentuk === "terencana" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="izin-mulai"
                className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold"
              >
                <CalendarDays className="size-3.5 text-muted-foreground" />
                Mulai
              </label>
              <input
                id="izin-mulai"
                type="date"
                value={mulai}
                min={besok}
                onChange={(e) => {
                  setMulai(e.target.value);
                  // Rentang mundur tidak pernah disengaja; ikutkan saja.
                  if (e.target.value > selesai) setSelesai(e.target.value);
                }}
                className="tabular h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="izin-selesai"
                className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold"
              >
                <CalendarDays className="size-3.5 text-muted-foreground" />
                Sampai
              </label>
              <input
                id="izin-selesai"
                type="date"
                value={selesai}
                min={mulai}
                onChange={(e) => setSelesai(e.target.value)}
                className="tabular h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>
        ) : null}

        {bentuk === "jam" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="jam-mulai"
                className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold"
              >
                <Clock className="size-3.5 text-muted-foreground" />
                Jam mulai
              </label>
              <input
                id="jam-mulai"
                type="time"
                value={jamMulai}
                onChange={(e) => setJamMulai(e.target.value)}
                className="tabular h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="jam-selesai"
                className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold"
              >
                <Clock className="size-3.5 text-muted-foreground" />
                Jam selesai
              </label>
              <input
                id="jam-selesai"
                type="time"
                value={jamSelesai}
                onChange={(e) => setJamSelesai(e.target.value)}
                className="tabular h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>
        ) : null}

        <p className="rounded-xl bg-muted px-4 py-2.5 text-[11px] leading-[14px] text-muted-foreground">
          {bentuk === "jam"
            ? "Kamu tetap absen masuk seperti biasa. Setelah izin disetujui, jam efektif masukmu bergeser ke jam selesai izin — telat dihitung ulang otomatis."
            : bentuk === "sakit"
              ? `Tercatat untuk ${tanggalPanjang(hariIni)}.`
              : hari > 1
                ? `${hari} hari, dari ${tanggalPanjang(isi.mulai)} sampai ${tanggalPanjang(isi.selesai)}. Cukup satu persetujuan untuk semuanya.`
                : `Satu hari, ${tanggalPanjang(isi.mulai)}.`}
        </p>

        <div className="space-y-1.5">
          <label
            htmlFor="alasan-izin"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Alasan
          </label>
          <textarea
            id="alasan-izin"
            rows={3}
            maxLength={MAKS_ALASAN_IZIN}
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder={
              bentuk === "sakit"
                ? "Mis. demam sejak semalam, istirahat sesuai anjuran klinik."
                : bentuk === "jam"
                  ? "Mis. mengantar anak ke dokter, kembali setelah itu."
                  : "Mis. mengurus dokumen keluarga di luar kota."
            }
            className="min-h-[88px] w-full resize-none rounded-xl bg-muted px-4 py-3 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <div className="flex items-center justify-between gap-2 text-[11px] leading-[14px]">
            <span
              className={cn(
                "font-semibold",
                keliru
                  ? "text-warn-text"
                  : salah
                    ? "font-normal text-muted-foreground"
                    : "text-ok-text",
              )}
            >
              {salah ?? "Siap diajukan"}
            </span>
            <span className="tabular text-muted-foreground">
              {alasan.length}/{MAKS_ALASAN_IZIN}
            </span>
          </div>
        </div>

        {hasil && !hasil.ok ? (
          <p
            role="status"
            className="rounded-xl bg-warn-fill px-4 py-2.5 text-[13px] leading-[18px] text-warn-text"
          >
            {hasil.teks}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={Boolean(salah) || mengirim}
          className="tekan-halus h-14 w-full rounded-full text-[13px] font-semibold"
        >
          {mengirim ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {mengirim ? "Mengirim…" : "Kirim pengajuan"}
        </Button>
      </form>
    </Card>
  );
}
