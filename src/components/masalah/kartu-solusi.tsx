"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PesanAksi, nadaHasil, type NadaPesan } from "@/components/shared/pesan-aksi";
import { MIN_SOLUSI, type IzinMasalah, type Masalah } from "@/lib/masalah";
import { simpanSolusiMasalah } from "@/app/actions/masalah";

/**
 * Solusi dari manajemen — satu kotak, satu jawaban.
 *
 * Menggantikan daftar tindakan berpenanggung-jawab dan bertenggat yang
 * dulu ada di sini. Daftar itu rapi di layar tapi menuntut tiga
 * keputusan sebelum satu kalimat pun tertulis, dan yang terjadi adalah
 * masalah selesai di dunia nyata sementara papannya tetap merah.
 *
 * Yang membaca kotak ini nanti bukan manajemen, melainkan orang
 * berikutnya yang kena masalah serupa — karena itu ia tetap terlihat
 * bagi semua orang yang boleh melihat laporannya, bukan hanya bagi yang
 * boleh menulisnya.
 */
export function KartuSolusi({
  masalah,
  izin,
}: {
  masalah: Masalah;
  izin: IzinMasalah;
}) {
  const [teks, setTeks] = useState(masalah.solusi);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<{ nada: NadaPesan; teks: string } | null>(
    null,
  );

  const simpan = (tandaiSelesai: boolean) => {
    if (menyimpan) return;
    mulai(async () => {
      setPesan(null);
      const hasil = await simpanSolusiMasalah({
        masalahId: masalah.id,
        solusi: teks,
        tandaiSelesai,
      });
      setPesan({ nada: nadaHasil(hasil), teks: hasil.pesan ?? "" });
    });
  };

  const cukup = teks.trim().length >= MIN_SOLUSI;
  const berubah = teks.trim() !== masalah.solusi.trim();

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">Solusi</h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {izin.isiSolusi
              ? "Tulis apa yang dilakukan untuk menyelesaikannya. Kalimat ini yang akan dibaca orang berikutnya yang kena masalah sama."
              : "Ditulis manajemen setelah laporan diproses."}
          </p>
        </div>

        {izin.isiSolusi ? (
          <>
            <textarea
              value={teks}
              maxLength={1000}
              rows={5}
              onChange={(e) => setTeks(e.target.value)}
              aria-label="Solusi"
              placeholder="Mis. jadwal pelatihan host dibuat bulanan, minimal 2 host cadangan per akun."
              className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={menyimpan || !berubah}
                onClick={() => simpan(false)}
                className="tekan-halus rounded-full"
              >
                {menyimpan ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Simpan solusi
              </Button>

              {masalah.status === "selesai" ? null : (
                <Button
                  type="button"
                  disabled={menyimpan || !cukup}
                  onClick={() => simpan(true)}
                  className="tekan-halus rounded-full"
                >
                  <Check className="size-4" />
                  Simpan &amp; tandai selesai
                </Button>
              )}

              {cukup ? null : (
                <span className="text-[11px] leading-[14px] text-muted-foreground">
                  Minimal {MIN_SOLUSI} huruf sebelum bisa ditandai selesai.
                </span>
              )}
            </div>
          </>
        ) : masalah.solusi ? (
          <p className="rounded-2xl bg-muted/50 px-4 py-3 text-[13px] leading-[18px] whitespace-pre-line">
            {masalah.solusi}
          </p>
        ) : (
          <p className="rounded-2xl bg-muted/50 px-4 py-3 text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Belum ada solusi yang ditulis.
          </p>
        )}

        {izin.alasanTakBisaIsi && izin.pengelola ? (
          <PesanAksi nada="netral">{izin.alasanTakBisaIsi}</PesanAksi>
        ) : null}

        {pesan ? <PesanAksi nada={pesan.nada}>{pesan.teks}</PesanAksi> : null}
      </div>
    </Card>
  );
}
