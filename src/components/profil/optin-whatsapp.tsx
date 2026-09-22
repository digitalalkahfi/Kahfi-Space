"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, CircleAlert, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogKonfirmasi } from "@/components/shared/dialog-konfirmasi";
import {
  PesanAksi,
  nadaHasil,
  type NadaPesan,
} from "@/components/shared/pesan-aksi";
import { ubahOptinWhatsapp } from "@/app/actions/profil";
import { PESAN_KESIAPAN, type KesiapanWhatsapp } from "@/lib/profil";

/**
 * Persetujuan dihubungi lewat WhatsApp, beserta petunjuk yang kurang.
 *
 * Tiga syaratnya dilaporkan satu per satu, dan tombolnya HANYA muncul
 * pada syarat yang memang bisa dipenuhi orangnya sendiri. Yang nomornya
 * belum diverifikasi tidak diberi tombol "setuju" yang selalu ditolak —
 * ia diberi tahu apa yang harus dilakukan.
 */
export function OptinWhatsapp({
  kesiapan,
  optin,
}: {
  kesiapan: KesiapanWhatsapp;
  optin: boolean;
}) {
  const [pesan, setPesan] = useState<string | null>(null);
  const [nada, setNada] = useState<NadaPesan>("netral");
  const [menyimpan, mulai] = useTransition();

  const kirim = (setuju: boolean) =>
    new Promise<void>((beres) => {
      mulai(async () => {
        const hasil = await ubahOptinWhatsapp(setuju);
        setNada(nadaHasil(hasil));
        setPesan(hasil.pesan ?? null);
        beres();
      });
    });

  return (
    <div className="space-y-2">
      <p
        className={
          kesiapan === "siap"
            ? "flex items-start gap-2 rounded-xl bg-ok-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-ok-text"
            : "flex items-start gap-2 rounded-xl bg-muted px-3 py-2 text-[11px] leading-[14px] text-pretty text-muted-foreground"
        }
      >
        {kesiapan === "siap" ? (
          <BadgeCheck className="mt-0.5 size-3 shrink-0" />
        ) : (
          <CircleAlert className="mt-0.5 size-3 shrink-0" />
        )}
        {PESAN_KESIAPAN[kesiapan]}
      </p>

      {kesiapan === "belum-diverifikasi" ? (
        <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
          Cara memverifikasi: kirim satu pesan apa pun dari nomor itu ke nomor
          WhatsApp resmi perusahaan, lalu beri tahu pengelola. Verifikasi
          dilakukan dari sisi mereka — tidak ada kode yang perlu kamu tunggu di
          sini.
        </p>
      ) : null}

      {kesiapan === "belum-setuju" ? (
        <DialogKonfirmasi
          judul="Setuju dihubungi lewat WhatsApp?"
          pesan="Notifikasi pada kategori yang kamu pilih akan dikirim ke nomor ini. Persetujuan bisa dicabut kapan saja, dan mencabutnya tidak menghilangkan notifikasi di aplikasi."
          labelYa="Ya, saya setuju"
          onSetuju={() => kirim(true)}
          pemicu={
            <Button
              type="button"
              disabled={menyimpan}
              className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
            >
              {menyimpan ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <MessageCircle className="size-3.5" />
              )}
              Setuju dihubungi lewat WhatsApp
            </Button>
          }
        />
      ) : null}

      {optin ? (
        <DialogKonfirmasi
          judul="Cabut persetujuan WhatsApp?"
          pesan="Pesan WhatsApp berhenti dikirim ke nomormu. Notifikasi tetap muncul di lonceng dan di halaman notifikasi — tidak ada kabar yang hilang."
          labelYa="Cabut persetujuan"
          berbahaya
          onSetuju={() => kirim(false)}
          pemicu={
            <Button
              type="button"
              variant="outline"
              disabled={menyimpan}
              className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
            >
              Cabut persetujuan
            </Button>
          }
        />
      ) : null}

      {pesan ? <PesanAksi nada={nada}>{pesan}</PesanAksi> : null}
    </div>
  );
}
