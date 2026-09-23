"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogKonfirmasi } from "@/components/shared/dialog-konfirmasi";
import { useTampilan } from "@/components/tampilan/penyedia-tampilan";
import { PERMUKAAN, itemTerlihat, urutanBerubah } from "@/lib/tampilan";
import { sukses } from "@/lib/data/hasil";

/**
 * Kembalikan seluruh pilihan ke susunan bawaan.
 *
 * Dilindungi dialog konfirmasi bersama karena satu klik di sini
 * menghapus pekerjaan menata yang bisa memakan beberapa menit, dan
 * tidak ada jalan membatalkannya. Kalimatnya menyebut berapa banyak
 * yang sedang disembunyikan — "apakah Anda yakin" tidak memberi tahu
 * apa pun tentang apa yang akan hilang.
 */
export function TombolBawaan() {
  const tampilan = useTampilan();
  if (!tampilan) return null;

  const { katalog, preferensi, kembalikanBawaan, pernahDiatur } = tampilan;

  const disembunyikan = PERMUKAAN.reduce(
    (jumlah, permukaan) =>
      jumlah +
      (katalog[permukaan].length -
        itemTerlihat(katalog, preferensi, permukaan).length),
    0,
  );

  const geser = urutanBerubah(katalog, preferensi);

  // Sebut yang benar-benar akan hilang, bukan kalimat umum. Orang
  // berhenti pada akibat yang disebutkan, bukan pada "apakah Anda
  // yakin".
  const akibat = [
    disembunyikan > 0
      ? `${disembunyikan} item yang kamu sembunyikan akan tampil lagi`
      : null,
    geser ? "urutan yang kamu susun kembali seperti semula" : null,
  ].filter(Boolean);

  return (
    <DialogKonfirmasi
      pemicu={
        <Button
          type="button"
          variant="outline"
          disabled={!pernahDiatur}
          className="tekan-halus rounded-full"
        >
          <RotateCcw className="size-4" />
          Kembalikan ke bawaan
        </Button>
      }
      judul="Kembalikan susunan bawaan?"
      pesan={
        akibat.length === 0
          ? "Susunanmu saat ini sudah sama dengan bawaan; tidak ada yang berubah."
          : `${akibat.join(", dan ")}.`
      }
      labelYa="Kembalikan"
      onSetuju={async () => {
        kembalikanBawaan();
        return sukses(undefined, "Susunan kembali ke bawaan.");
      }}
    />
  );
}
