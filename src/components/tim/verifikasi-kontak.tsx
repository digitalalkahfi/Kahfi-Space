"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, Loader2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogKonfirmasi } from "@/components/shared/dialog-konfirmasi";
import {
  PesanAksi,
  nadaHasil,
  type NadaPesan,
} from "@/components/shared/pesan-aksi";
import {
  cabutVerifikasiAnggota,
  verifikasiKontakAnggota,
} from "@/app/actions/verifikasi-kontak";
import { formatKontak } from "@/lib/profil";

/**
 * Tombol verifikasi nomor untuk pengelola.
 *
 * Hanya muncul kalau orangnya memang sudah mengisi nomor: memverifikasi
 * nomor kosong tidak berarti apa-apa, dan tombol yang selalu ditolak
 * mengajari orang bahwa tombol di aplikasi ini kadang tidak berarti.
 */
export function VerifikasiKontak({
  userId,
  nama,
  kontak,
  terverifikasi,
}: {
  userId: string;
  nama: string;
  kontak: string | null;
  terverifikasi: boolean;
}) {
  const [pesan, setPesan] = useState<string | null>(null);
  const [nada, setNada] = useState<NadaPesan>("netral");
  const [memproses, mulai] = useTransition();

  if (!kontak) return null;

  const jalankan = (aksi: () => Promise<{ ok: boolean; pesan?: string }>) =>
    new Promise<void>((beres) => {
      mulai(async () => {
        const hasil = await aksi();
        setNada(nadaHasil(hasil as Parameters<typeof nadaHasil>[0]));
        setPesan(hasil.pesan ?? null);
        beres();
      });
    });

  return (
    <div className="space-y-2">
      {terverifikasi ? (
        <DialogKonfirmasi
          judul={`Cabut verifikasi nomor ${nama}?`}
          pesan={`Persetujuan WhatsApp-nya ikut dicabut, dan pesan berhenti dikirim ke ${formatKontak(kontak)}. Notifikasi di aplikasi tidak terpengaruh.`}
          labelYa="Cabut verifikasi"
          berbahaya
          onSetuju={() => jalankan(() => cabutVerifikasiAnggota(userId))}
          pemicu={
            <Button
              type="button"
              variant="outline"
              disabled={memproses}
              className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
            >
              {memproses ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ShieldOff className="size-3.5" />
              )}
              Cabut verifikasi nomor
            </Button>
          }
        />
      ) : (
        <DialogKonfirmasi
          judul={`Tandai nomor ${nama} terverifikasi?`}
          pesan={`Lakukan ini hanya setelah kamu benar-benar menerima pesan dari ${formatKontak(kontak)} di nomor resmi perusahaan. Setelah ini, ${nama} masih perlu menyetujui sendiri sebelum ada pesan yang dikirim.`}
          labelYa="Ya, sudah terbukti"
          onSetuju={() => jalankan(() => verifikasiKontakAnggota(userId))}
          pemicu={
            <Button
              type="button"
              variant="outline"
              disabled={memproses}
              className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
            >
              {memproses ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <BadgeCheck className="size-3.5" />
              )}
              Verifikasi nomor
            </Button>
          }
        />
      )}

      {pesan ? <PesanAksi nada={nada}>{pesan}</PesanAksi> : null}
    </div>
  );
}
