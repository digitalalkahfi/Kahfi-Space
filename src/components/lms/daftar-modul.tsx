"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen } from "@/lib/format";
import {
  jumlahTuntas,
  modulBerikutnya,
  persenKemajuan,
  type Kursus,
} from "@/lib/lms";
import { ikutiKursus, tandaiModul } from "@/app/actions/lms";

/**
 * Daftar modul beserta penandaan tuntas.
 *
 * Modul boleh ditandai dalam urutan apa pun: orang yang sudah menguasai
 * bagian awal tidak perlu berpura-pura membukanya. Yang dijaga hanyalah
 * bahwa kursus baru dianggap lulus ketika semuanya tuntas.
 */
export function DaftarModul({ kursus }: { kursus: Kursus }) {
  const [mengubah, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  const kemajuan = persenKemajuan(kursus);
  const berikut = modulBerikutnya(kursus);
  const lulus = kursus.selesaiPada !== null;

  const daftar = () =>
    mulai(async () => {
      setPesan(null);
      const hasil = await ikutiKursus(kursus.id);
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
    });

  const alihkan = (modulId: string, tuntas: boolean) =>
    mulai(async () => {
      setPesan(null);
      const hasil = await tandaiModul({
        kursusId: kursus.id,
        modulId,
        tuntas,
      });
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
    });

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="text-base leading-6 font-semibold">Modul kursus</h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {kursus.terdaftar
              ? `${jumlahTuntas(kursus)} dari ${kursus.modul.length} modul tuntas · ${persen(kemajuan, 0)}`
              : `${kursus.modul.length} modul`}
          </p>
        </div>

        {!kursus.terdaftar ? (
          <Button
            type="button"
            disabled={mengubah}
            onClick={daftar}
            className="tekan-halus sentuh-nyaman h-9 shrink-0 rounded-full px-4 text-[11px] font-semibold"
          >
            {mengubah ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            Mulai kursus
          </Button>
        ) : null}
      </div>

      {kursus.terdaftar ? (
        <div className="flex items-center gap-2 px-5">
          <span
            aria-hidden
            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <span
              className={cn(
                "block h-full rounded-full transition-[width]",
                lulus ? "bg-ok" : "bg-secondary",
              )}
              style={{ width: `${kemajuan}%` }}
            />
          </span>
          <span className="tabular shrink-0 text-[11px] leading-[14px] font-semibold">
            {persen(kemajuan, 0)}
          </span>
        </div>
      ) : null}

      <ol className="space-y-2 px-5">
        {kursus.modul.map((m) => {
          const sorotan = kursus.terdaftar && berikut?.id === m.id;
          return (
            <li
              key={m.id}
              className={cn(
                "flex items-start gap-3 rounded-2xl p-3",
                m.tuntas
                  ? "bg-ok-fill"
                  : sorotan
                    ? "bg-info-fill"
                    : "bg-muted/50",
              )}
            >
              <button
                type="button"
                disabled={!kursus.terdaftar || mengubah}
                onClick={() => alihkan(m.id, !m.tuntas)}
                aria-pressed={m.tuntas}
                aria-label={
                  m.tuntas
                    ? `Batalkan penandaan tuntas: ${m.judul}`
                    : `Tandai tuntas: ${m.judul}`
                }
                title={
                  kursus.terdaftar
                    ? undefined
                    : "Mulai kursusnya dulu untuk menandai modul"
                }
                className={cn(
                  "tekan-halus mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md ring-1",
                  m.tuntas
                    ? "bg-ok text-white ring-ok"
                    : "bg-card ring-border-subtle",
                  !kursus.terdaftar && "opacity-50",
                )}
              >
                {mengubah ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : m.tuntas ? (
                  <Check className="size-3.5" />
                ) : null}
              </button>

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[13px] leading-[18px] font-medium text-pretty",
                    m.tuntas && "opacity-70",
                  )}
                >
                  {m.urutan}. {m.judul}
                </span>
                <span className="flex items-center gap-1 text-[11px] leading-[14px] opacity-70">
                  <Clock className="size-3 shrink-0" />
                  {m.durasiMenit} menit
                  {sorotan ? " · lanjutkan dari sini" : ""}
                </span>
                {m.isi ? (
                  <Link
                    href={`/lms/${kursus.id}/${m.urutan}`}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] leading-[14px] font-semibold underline"
                  >
                    Baca modul
                    <ArrowRight className="size-3" />
                  </Link>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      {lulus ? (
        <p className="mx-5 rounded-2xl bg-ok-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-ok-text">
          Seluruh modul tuntas. Kursus ini tercatat selesai.
        </p>
      ) : null}

      {pesan ? (
        <p
          role="status"
          className={
            berhasil
              ? "mx-5 rounded-2xl bg-ok-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-ok-text"
              : "mx-5 rounded-2xl bg-warn-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-warn-text"
          }
        >
          {pesan}
        </p>
      ) : null}
    </Card>
  );
}
