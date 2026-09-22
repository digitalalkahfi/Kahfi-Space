"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalPendek } from "@/lib/format";
import {
  AMBANG_LULUS_KUIS,
  minimalBenar,
  percobaanTerbaik,
  type HasilKuis,
  type PercobaanKuis,
  type SoalKuis,
} from "@/lib/lms";
import { kirimKuis } from "@/app/actions/lms";

/**
 * Pengerjaan kuis satu modul.
 *
 * Hasilnya hanya berupa skor, tanpa menunjukkan soal mana yang salah:
 * membocorkan itu membuat percobaan berikutnya cukup dikerjakan dengan
 * menghafal, bukan dengan membaca ulang materinya.
 */
export function PengerjaanKuis({
  kursusId,
  modulId,
  modulUrutan,
  soal,
  riwayat,
}: {
  kursusId: string;
  modulId: string;
  modulUrutan: number;
  soal: SoalKuis[];
  riwayat: PercobaanKuis[];
}) {
  const [jawaban, setJawaban] = useState<Record<number, number>>({});
  const [hasil, setHasil] = useState<HasilKuis | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);
  const [mengirim, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const terbaik = percobaanTerbaik(riwayat);
  const terjawab = Object.keys(jawaban).length;
  const siap = terjawab === soal.length && soal.length > 0;

  const kirim = () => {
    if (!siap || mengirim) return;
    mulai(async () => {
      setPesan(null);
      const urut = [...soal].sort((a, b) => a.urutan - b.urutan);
      const hasilKirim = await kirimKuis({
        kursusId,
        modulId,
        jawaban: urut.map((s) => jawaban[s.urutan] ?? -1),
      });

      if (hasilKirim.ok && hasilKirim.data) {
        setHasil(hasilKirim.data);
        // Pesan dari server, bukan teks tetap: di mode demo ia menyebut
        // bahwa hasilnya tidak tersimpan.
        setKabar(hasilKirim.pesan ?? null);
        return;
      }
      setPesan(hasilKirim.pesan ?? null);
    });
  };

  const ulangi = () => {
    setHasil(null);
    setJawaban({});
    setPesan(null);
    setKabar(null);
  };

  if (hasil) {
    return (
      <Card
        className={cn(
          "rounded-3xl shadow-card ring-0",
          hasil.lulus ? "bg-ok-fill" : "bg-warn-fill",
        )}
      >
        <div className="flex flex-col items-center gap-2 px-5 text-center">
          {hasil.lulus ? (
            <CheckCircle2 className="size-10 text-ok-text" />
          ) : (
            <XCircle className="size-10 text-warn-text" />
          )}
          <p
            className={cn(
              "tabular text-4xl leading-none font-bold tracking-tight",
              hasil.lulus ? "text-ok-text" : "text-warn-text",
            )}
          >
            {hasil.skor}
          </p>
          <p
            className={cn(
              "text-[13px] leading-[18px] text-pretty",
              hasil.lulus ? "text-ok-text" : "text-warn-text",
            )}
          >
            {hasil.benar} dari {hasil.total} soal benar.{" "}
            {kabar ?? `Ambang lulusnya ${AMBANG_LULUS_KUIS}.`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 px-5">
          {!hasil.lulus ? (
            <>
              <Link
                href={`/lms/${kursusId}/${modulUrutan}`}
                className="tekan-halus sentuh-nyaman inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-card text-[11px] font-semibold"
              >
                Baca ulang materinya
              </Link>
              <Button
                type="button"
                variant="outline"
                onClick={ulangi}
                className="tekan-halus sentuh-nyaman h-11 flex-1 rounded-full bg-card text-[11px] font-semibold"
              >
                <RotateCcw className="size-3.5" />
                Coba lagi
              </Button>
            </>
          ) : (
            <Link
              href={`/lms/${kursusId}`}
              className="tekan-halus sentuh-nyaman inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-card text-[11px] font-semibold"
            >
              Kembali ke kursus
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="px-5">
          <h2 className="text-base leading-6 font-semibold">Kuis modul</h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {soal.length} soal · minimal {minimalBenar(soal.length)} benar untuk
            lulus. Boleh diulang sebanyak yang diperlukan.
          </p>
        </div>

        {terbaik ? (
          <p className="mx-5 rounded-2xl bg-muted px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
            Skor terbaikmu sejauh ini {terbaik.skor}
            {terbaik.lulus ? " (lulus)" : ""} · {riwayat.length} kali dikerjakan
            · terakhir {tanggalPendek(riwayat[0].dikerjakanPada)}
          </p>
        ) : null}
      </Card>

      <ol className="space-y-3">
        {soal.map((s) => (
          <li key={s.id}>
            <Card className="rounded-3xl shadow-card ring-border-subtle">
              <p className="px-5 text-[15px] leading-[24px] font-semibold text-pretty">
                {s.urutan}. {s.pertanyaan}
              </p>

              <div className="space-y-1.5 px-5">
                {s.pilihan.map((p, i) => {
                  const dipilih = jawaban[s.urutan] === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setJawaban((j) => ({ ...j, [s.urutan]: i }))
                      }
                      aria-pressed={dipilih}
                      className={cn(
                        "baris-interaktif flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[13px] leading-[18px]",
                        dipilih
                          ? "bg-primary/10 font-semibold ring-1 ring-primary/30"
                          : "bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                          dipilih
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground",
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-pretty">{p}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </li>
        ))}
      </ol>

      {pesan ? (
        <p
          role="status"
          className="rounded-2xl bg-warn-fill px-4 py-2.5 text-[13px] leading-[18px] text-pretty text-warn-text"
        >
          {pesan}
        </p>
      ) : null}

      <div className="sticky bottom-24 z-10 rounded-3xl bg-card/95 p-3 shadow-card ring-1 ring-border-subtle backdrop-blur lg:bottom-6">
        <Button
          type="button"
          disabled={!siap || mengirim}
          onClick={kirim}
          className="tekan-halus sentuh-nyaman h-12 w-full rounded-full text-[13px] font-semibold"
        >
          {mengirim ? <Loader2 className="size-4 animate-spin" /> : null}
          {terjawab < soal.length
            ? `Jawab ${soal.length - terjawab} soal lagi`
            : "Kirim jawaban"}
        </Button>
      </div>
    </div>
  );
}
