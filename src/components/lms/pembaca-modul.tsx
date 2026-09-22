"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tandaiModul } from "@/app/actions/lms";
import type { Kursus, ModulKursus } from "@/lib/lms";

/**
 * Pembaca satu modul, dirancang untuk layar ponsel.
 *
 * Yang menentukan nyaman atau tidaknya membaca di HP bukan ukuran huruf
 * saja, melainkan panjang baris dan jarak antarbaris. Lebar teks
 * dibatasi walau layarnya lebar, dan tombol lanjut menempel di bawah
 * supaya bisa ditekan dengan satu tangan tanpa menggulir balik.
 */
export function PembacaModul({
  kursus,
  modul,
}: {
  kursus: Kursus;
  modul: ModulKursus;
}) {
  const [mengubah, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const urut = [...kursus.modul].sort((a, b) => a.urutan - b.urutan);
  const posisi = urut.findIndex((m) => m.id === modul.id);
  const sebelumnya = posisi > 0 ? urut[posisi - 1] : null;
  const berikutnya = posisi < urut.length - 1 ? urut[posisi + 1] : null;

  const paragraf = modul.isi
    .split("\n\n")
    .map((t) => t.trim())
    .filter(Boolean);

  const tandai = () =>
    mulai(async () => {
      setPesan(null);
      const hasil = await tandaiModul({
        kursusId: kursus.id,
        modulId: modul.id,
        tuntas: !modul.tuntas,
      });
      if (!hasil.ok) setPesan(hasil.pesan ?? null);
    });

  return (
    <div className="space-y-4">
      {/* Penunjuk posisi: sekilas terlihat sudah sampai mana. */}
      <div className="flex items-center gap-1">
        {urut.map((m) => (
          <span
            key={m.id}
            aria-hidden
            className={cn(
              "h-1 flex-1 rounded-full",
              m.id === modul.id
                ? "bg-primary"
                : m.tuntas
                  ? "bg-ok"
                  : "bg-border-subtle",
            )}
          />
        ))}
      </div>

      <div>
        <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          Modul {modul.urutan} dari {urut.length} · {modul.durasiMenit} menit
        </p>
        <h1 className="mt-1 text-[24px] leading-8 font-bold tracking-tight text-pretty lg:text-[30px] lg:leading-10">
          {modul.judul}
        </h1>
      </div>

      {/* Ruang bawah pada teks supaya paragraf terakhir bisa tergulir
          melewati panel aksi yang menempel. */}
      {paragraf.length > 0 ? (
        <article className="max-w-[62ch] space-y-4 pb-24">
          {paragraf.map((t, i) => (
            <p key={i} className="text-[17px] leading-[30px] text-pretty">
              {t}
            </p>
          ))}
        </article>
      ) : (
        <p className="pb-24 text-[15px] leading-[26px] text-muted-foreground">
          Materi modul ini belum ditulis.
        </p>
      )}

      {pesan ? (
        <p
          role="status"
          className="rounded-2xl bg-warn-fill px-4 py-2.5 text-[13px] leading-[18px] text-pretty text-warn-text"
        >
          {pesan}
        </p>
      ) : null}

      {/* Aksi menempel di bawah: terjangkau satu tangan, tanpa menggulir balik. */}
      <div className="sticky bottom-24 z-10 space-y-2 rounded-3xl bg-card/95 p-3 shadow-card ring-1 ring-border-subtle backdrop-blur lg:bottom-6">
        <Button
          type="button"
          disabled={!kursus.terdaftar || mengubah}
          onClick={tandai}
          variant={modul.tuntas ? "outline" : "default"}
          className="tekan-halus sentuh-nyaman h-12 w-full rounded-full text-[13px] font-semibold"
        >
          {mengubah ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          {!kursus.terdaftar
            ? "Mulai kursusnya dulu"
            : modul.tuntas
              ? "Batalkan tanda tuntas"
              : "Tandai modul ini tuntas"}
        </Button>

        <Link
          href={`/lms/${kursus.id}/${modul.urutan}/kuis`}
          className="tekan-halus sentuh-nyaman inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-muted text-[11px] font-semibold"
        >
          Kerjakan kuis modul ini
          <ArrowRight className="size-3.5" />
        </Link>

        <div className="flex gap-2">
          {sebelumnya ? (
            <Link
              href={`/lms/${kursus.id}/${sebelumnya.urutan}`}
              className="tekan-halus sentuh-nyaman inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-muted text-[11px] font-semibold"
            >
              <ArrowLeft className="size-3.5" />
              Modul {sebelumnya.urutan}
            </Link>
          ) : null}

          {berikutnya ? (
            <Link
              href={`/lms/${kursus.id}/${berikutnya.urutan}`}
              className="tekan-halus sentuh-nyaman inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-muted text-[11px] font-semibold"
            >
              Modul {berikutnya.urutan}
              <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <Link
              href={`/lms/${kursus.id}`}
              className="tekan-halus sentuh-nyaman inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-muted text-[11px] font-semibold"
            >
              Kembali ke kursus
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
