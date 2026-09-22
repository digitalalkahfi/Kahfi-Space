"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Link2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ubahTautanProduk } from "@/app/actions/sampel";
import { etalaseProduk, tautanProdukSah } from "@/lib/sampel";

/**
 * Tombol "Buka produk" sekaligus tempat menggantinya.
 *
 * Keduanya berdampingan karena memang satu pekerjaan: orang membuka
 * etalase, menemukan produknya sudah pindah, lalu menempelkan link yang
 * baru. Stiker QR tidak ikut berubah — isinya kode sampel, bukan URL —
 * jadi barangnya tidak perlu dicetak ulang.
 */
export function KelolaLink({
  sampelId,
  tautanAwal,
  bolehUbah,
}: {
  sampelId: string;
  tautanAwal: string | null;
  /** Menyunting sampel adalah wewenang CEO/Manager. */
  bolehUbah: boolean;
}) {
  const [tautan, setTautan] = useState(tautanAwal ?? "");
  const [tersimpan, setTersimpan] = useState(tautanAwal ?? "");
  const [sunting, setSunting] = useState(false);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const bolehBuka = tautanProdukSah(tersimpan);
  const keliru = tautan.trim() !== "" && !tautanProdukSah(tautan);
  const berubah = tautan.trim() !== tersimpan.trim();

  const simpan = () =>
    mulai(async () => {
      setPesan(null);
      const hasil = await ubahTautanProduk(sampelId, tautan);
      setPesan(hasil.pesan ?? null);
      if (hasil.ok) {
        setTersimpan(tautan.trim());
        setSunting(false);
      }
    });

  return (
    <div className="space-y-2 px-5">
      <div className="flex flex-wrap items-center gap-2">
        {bolehBuka ? (
          <a
            href={tersimpan}
            target="_blank"
            rel="noopener noreferrer"
            className="tekan-halus sentuh-nyaman inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-[11px] leading-[14px] font-semibold text-primary-foreground"
          >
            <ExternalLink className="size-3.5" />
            Buka produk di {etalaseProduk(tersimpan)}
          </a>
        ) : null}

        {bolehUbah ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPesan(null);
              setTautan(tersimpan);
              setSunting((b) => !b);
            }}
            className="tekan-halus sentuh-nyaman h-10 rounded-full px-4 text-[11px] font-semibold"
          >
            <Link2 className="size-3.5" />
            {bolehBuka ? "Ganti link" : "Tambah link"}
          </Button>
        ) : null}
      </div>

      {!bolehBuka && !sunting ? (
        <p className="rounded-2xl border border-dashed border-border-subtle px-4 py-3 text-[11px] leading-[14px] text-pretty text-muted-foreground">
          Tautan produk belum diisi. Menambahkannya tidak membatalkan stiker QR
          yang sudah tercetak — keduanya memang terpisah.
        </p>
      ) : null}

      {sunting ? (
        <div className="space-y-2 rounded-2xl bg-muted/50 p-3">
          <label
            htmlFor="tautan-produk"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Tautan etalase
          </label>
          <input
            id="tautan-produk"
            type="url"
            inputMode="url"
            value={tautan}
            maxLength={300}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setTautan(e.target.value)}
            aria-invalid={keliru}
            placeholder="https://shopee.co.id/… atau https://tiktok.com/…"
            className="h-12 w-full rounded-xl bg-card px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <p
            className={cn(
              "text-[11px] leading-[14px] text-pretty",
              keliru ? "text-warn-text" : "text-muted-foreground",
            )}
          >
            {keliru
              ? "Tautan harus diawali http:// atau https://."
              : "Dikosongkan berarti tautannya dilepas. Kode QR tetap sama."}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={keliru || !berubah || menyimpan}
              onClick={simpan}
              className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
            >
              {menyimpan ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Simpan tautan
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTautan(tersimpan);
                setSunting(false);
                setPesan(null);
              }}
              className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
            >
              <X className="size-3.5" />
              Batal
            </Button>
          </div>
        </div>
      ) : null}

      {pesan ? (
        <p
          role="status"
          className="rounded-2xl bg-muted px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-muted-foreground"
        >
          {pesan}
        </p>
      ) : null}
    </div>
  );
}
