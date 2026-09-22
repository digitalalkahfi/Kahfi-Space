"use client";

import { useState } from "react";
import { KartuHasilPindai } from "@/components/sampel/kartu-hasil-pindai";
import { PemindaiQr } from "@/components/sampel/pemindai-qr";
import type { Sampel } from "@/lib/sampel";

/**
 * Layar pemindaian: pemindai di atas, hasil terakhir di bawahnya.
 *
 * Hasil sebelumnya sengaja tidak langsung hilang saat memindai berikutnya
 * — di gudang, orang kerap memindai beberapa barang berturut-turut lalu
 * ingin memastikan yang barusan memang sudah benar.
 */
export function LayarPindai() {
  const [terakhir, setTerakhir] = useState<Sampel[]>([]);

  const tambah = (sampel: Sampel) =>
    setTerakhir((sebelumnya) =>
      [sampel, ...sebelumnya.filter((s) => s.id !== sampel.id)].slice(0, 5),
    );

  return (
    <div className="space-y-4">
      <PemindaiQr onKetemu={tambah} />

      {terakhir.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Baru saja dipindai
          </p>
          {terakhir.map((s) => (
            <KartuHasilPindai key={s.id} sampel={s} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
