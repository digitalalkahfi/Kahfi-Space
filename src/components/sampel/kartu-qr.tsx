"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { Printer, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahPenuh } from "@/lib/format";
import { jalurQr, petaQr, TEPI_QR } from "@/lib/qr";

type Mode = "qr" | "label";

/** Gambar QR-nya sendiri; dipakai di layar maupun di lembar cetak. */
function GambarQr({ kode, className }: { kode: string; className?: string }) {
  const peta = petaQr(kode);
  const jalur = jalurQr(peta);
  const sisi = peta.ukuran + TEPI_QR * 2;

  return (
    <svg
      viewBox={`0 0 ${sisi} ${sisi}`}
      role="img"
      aria-label={`Kode QR ${kode}`}
      className={cn("rounded-2xl bg-white p-1", className)}
      shapeRendering="crispEdges"
    >
      {/* Tepi kosong wajib; tanpa itu pemindai kesulitan menemukan tepinya. */}
      <rect width={sisi} height={sisi} fill="#ffffff" />
      <g transform={`translate(${TEPI_QR} ${TEPI_QR})`}>
        <path d={jalur} fill="#0f172a" />
      </g>
    </svg>
  );
}

/**
 * Pratinjau kode QR sampel beserta dua cara mencetaknya.
 *
 * Isi QR-nya sengaja hanya kodenya, bukan URL: stiker menempel pada barang
 * selama bertahun-tahun, sedangkan alamat aplikasi bisa berubah. Kode yang
 * pendek juga menghasilkan pola yang lebih renggang dan lebih mudah terbaca
 * dari jarak jauh.
 *
 * Dua tombolnya menjawab dua kebutuhan yang berbeda: "Cetak QR" untuk
 * menempel ulang stiker yang rusak, "Cetak label" untuk barang baru yang
 * perlu keterangan nama, brand, dan nilainya sekalian.
 */
export function KartuQr({
  kode,
  nama,
  brand,
  nilai,
  unitNama,
}: {
  kode: string;
  nama?: string;
  brand?: string;
  nilai?: number;
  unitNama?: string;
}) {
  const [mode, setMode] = useState<Mode>("label");

  const cetak = (pilihan: Mode) => {
    // Dipaksa ter-render lebih dulu, bukan menunggu frame berikutnya:
    // `requestAnimationFrame` tidak dijalankan peramban saat tab sedang
    // tidak tampil, dan tombol cetak yang diam adalah tombol yang rusak.
    flushSync(() => setMode(pilihan));
    window.print();
  };

  return (
    <>
      <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
        <div className="px-5">
          <h2 className="text-base leading-6 font-semibold">Stiker QR</h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Cetak dan tempel pada barangnya. Isinya hanya kodenya, supaya
            stikernya tetap berlaku walau alamat aplikasi berubah.
          </p>
        </div>

        <div className="flex flex-col items-center gap-2 px-5">
          <GambarQr kode={kode} className="size-44" />
          <p className="tabular font-mono text-[13px] leading-[18px] font-semibold">
            {kode}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 px-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => cetak("qr")}
            className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
          >
            <Printer className="size-3.5" />
            Cetak QR
          </Button>
          <Button
            type="button"
            onClick={() => cetak("label")}
            className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
          >
            <Tag className="size-3.5" />
            Cetak label
          </Button>
        </div>
      </Card>

      {/*
        Lembar cetak: tidak terlihat di layar, satu-satunya yang ikut ke
        kertas (aturan `.area-cetak` di globals.css).
      */}
      <div className="area-cetak hidden print:block">
        <div
          className={cn(
            "mx-auto flex items-center gap-4 border border-[#0f172a]/20 p-4",
            mode === "qr" ? "w-[52mm] flex-col text-center" : "w-[92mm]",
          )}
        >
          <GambarQr
            kode={kode}
            className={mode === "qr" ? "w-[40mm]" : "w-[32mm] shrink-0"}
          />

          <div className="min-w-0">
            <p className="font-mono text-[12px] leading-[16px] font-bold">
              {kode}
            </p>

            {mode === "label" ? (
              <>
                {nama ? (
                  <p className="text-[13px] leading-[17px] font-semibold text-pretty">
                    {nama}
                  </p>
                ) : null}
                {brand ? (
                  <p className="text-[11px] leading-[15px]">{brand}</p>
                ) : null}
                <p className="text-[10px] leading-[14px]">
                  {[
                    unitNama,
                    typeof nilai === "number" ? rupiahPenuh(nilai) : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-1 text-[9px] leading-[12px]">
                  K-Space V2 · pindai untuk melihat riwayatnya
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
