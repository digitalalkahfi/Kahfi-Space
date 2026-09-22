"use client";

import { useState, useTransition } from "react";
import { Bell, Loader2, Lock, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PesanAksi,
  nadaHasil,
  type NadaPesan,
} from "@/components/shared/pesan-aksi";
import { ubahSatuPreferensi } from "@/app/actions/preferensi-notifikasi";
import { KartuPreferensi } from "@/components/notifikasi/kartu-preferensi";
import {
  bolehMematikan,
  ubahPreferensi,
  type Kanal,
  type PreferensiNotifikasi,
} from "@/lib/preferensi-notifikasi";
import type { KategoriNotifikasi } from "@/lib/notifikasi";
import type { Peran } from "@/lib/types";

const LABEL_KANAL: Record<Kanal, string> = {
  inApp: "Di aplikasi",
  whatsapp: "WhatsApp",
};

/**
 * Pengaturan preferensi yang bisa ditekan.
 *
 * Perubahannya terlihat seketika di layar sebelum server menjawab —
 * saklar yang menunggu satu perjalanan jaringan sebelum bergerak
 * terasa rusak, dan orang akan menekannya dua kali. Kalau server
 * menolak, keadaannya dikembalikan dan alasannya ditulis.
 */
export function SaklarPreferensi({
  awal,
  peran,
  kontak,
}: {
  awal: PreferensiNotifikasi;
  peran: Peran;
  /** Nomor WhatsApp pada profil; null berarti kanal itu belum bisa dipakai. */
  kontak: string | null;
}) {
  const [preferensi, setPreferensi] = useState(awal);
  const [pesan, setPesan] = useState<string | null>(null);
  const [nada, setNada] = useState<NadaPesan>("netral");
  const [menyimpan, mulai] = useTransition();

  const adaKontak = kontak !== null;

  const tekan = (
    kategori: KategoriNotifikasi,
    kanal: Kanal,
    nyalaSekarang: boolean,
  ) => {
    const nyala = !nyalaSekarang;

    // Menyalakan WhatsApp tanpa nomor tujuan bukan pengaturan, melainkan
    // janji yang tidak bisa ditepati.
    if (kanal === "whatsapp" && nyala && !adaKontak) {
      setNada("gagal");
      setPesan(
        "Isi dulu nomor kontak di halaman Profil — tanpa nomor tujuan, tidak ada yang bisa dikirim.",
      );
      return;
    }

    const { hasil, ditolak } = ubahPreferensi(
      preferensi,
      kategori,
      kanal,
      nyala,
      peran,
    );

    if (ditolak) {
      setNada("gagal");
      setPesan(ditolak);
      return;
    }

    const sebelum = preferensi;
    setPreferensi(hasil);
    setPesan(null);

    mulai(async () => {
      const balasan = await ubahSatuPreferensi(kategori, kanal, nyala);
      if (!balasan.ok && balasan.kode !== "demo") {
        setPreferensi(sebelum); // kembalikan; servernya yang menolak
      }
      setNada(nadaHasil(balasan));
      setPesan(balasan.pesan ?? null);
    });
  };

  return (
    <div className="space-y-3">
      <KartuPreferensi
        preferensi={preferensi}
        peran={peran}
        kontak={kontak}
        saklar={(kategori, kanal, nyala) => {
          const Ikon = kanal === "inApp" ? Bell : MessageCircle;

          // Kanal in-app yang MENYALA dan tidak boleh dimatikan bukan
          // saklar — ia keterangan. Menampilkannya sebagai tombol
          // berarti menawarkan sesuatu yang selalu ditolak, dan itu
          // mengajari orang bahwa tombol di aplikasi ini kadang tidak
          // berarti apa-apa.
          //
          // Yang MATI tetap tombol: larangannya satu arah — peran mana
          // pun boleh menyalakan kembali.
          if (kanal === "inApp" && nyala && !bolehMematikan(peran)) {
            return (
              <span
                key={kanal}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] leading-[14px] font-semibold text-primary"
              >
                <Lock className="size-3" />
                Di aplikasi · selalu
              </span>
            );
          }

          return (
            <button
              key={kanal}
              type="button"
              role="switch"
              aria-checked={nyala}
              aria-label={`${LABEL_KANAL[kanal]} untuk kategori ini`}
              disabled={menyimpan}
              onClick={() => tekan(kategori, kanal, nyala)}
              className={cn(
                "tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold",
                nyala
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {menyimpan ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Ikon className="size-3" />
              )}
              {LABEL_KANAL[kanal]}
            </button>
          );
        }}
      />

      {pesan ? (
        <PesanAksi nada={nada} ukuran="sedang">
          {pesan}
        </PesanAksi>
      ) : null}
    </div>
  );
}
