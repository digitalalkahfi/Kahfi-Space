"use client";

import { useState } from "react";
import { MessageCircle, Pencil, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogKonfirmasi } from "@/components/shared/dialog-konfirmasi";
import {
  DialogUbahPenjual,
  type CalonPic,
} from "@/components/penjual/dialog-penjual";
import { cn } from "@/lib/utils";
import { tanggalRelatif } from "@/lib/format";
import {
  GAYA_STATUS_PENJUAL,
  LABEL_STATUS_PENJUAL,
  izinPenjual,
  tautanWhatsApp,
  type Penjual,
} from "@/lib/penjual";
import { hapusPenjual } from "@/app/actions/penjual";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

export function KartuPenjual({
  penjual,
  pengguna,
  pilihan,
  anggota,
  unitTerkunci,
  acuan,
}: {
  penjual: Penjual;
  pengguna: { id: string; role: string; unitId: KodeUnit | null };
  pilihan: PilihanOrganisasi;
  anggota: CalonPic[];
  unitTerkunci: KodeUnit | null;
  acuan: string;
}) {
  const [ubah, setUbah] = useState(false);
  const izin = izinPenjual(pengguna, penjual);
  const gaya = GAYA_STATUS_PENJUAL[penjual.status];
  const wa = tautanWhatsApp(penjual.telepon);

  return (
    <li className="rounded-2xl bg-muted/50 p-3.5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-card text-muted-foreground">
          <Store className="size-4" />
        </span>

        <div className="min-w-[10rem] flex-1">
          <p className="text-sm leading-5 font-semibold text-pretty">
            {penjual.namaToko}
            {penjual.kategori ? (
              <span className="ml-1.5 font-normal text-muted-foreground">
                · {penjual.kategori}
              </span>
            ) : null}
          </p>
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            {penjual.namaKontak || "Kontak belum dicatat"}
            {penjual.telepon ? ` · ${penjual.telepon}` : ""}
          </p>
          <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
            {penjual.unitNama}
            {penjual.picNama ? ` · PIC ${penjual.picNama}` : " · tanpa PIC"}
            {penjual.komisiPersen !== null
              ? ` · komisi ${penjual.komisiPersen}%`
              : ""}{" "}
            · {tanggalRelatif(penjual.diperbaruiPada, acuan)}
          </p>
        </div>

        <span className="flex h-fit shrink-0 flex-wrap items-center gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
              gaya.kelas,
            )}
          >
            <span className={cn("size-1.5 rounded-full", gaya.titik)} />
            {LABEL_STATUS_PENJUAL[penjual.status]}
          </span>
        </span>
      </div>

      {penjual.catatan ? (
        <p className="mt-2 text-[12px] leading-[16px] text-pretty whitespace-pre-line text-muted-foreground">
          {penjual.catatan}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="tekan-halus sentuh-nyaman inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-[11px] leading-[14px] font-semibold ring-1 ring-border-subtle hover:text-foreground"
          >
            <MessageCircle className="size-3.5" />
            WhatsApp
          </a>
        ) : null}
        {izin.ubah ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setUbah(true)}
            className="tekan-halus sentuh-nyaman h-7 rounded-full px-2.5 text-[11px] font-semibold"
          >
            <Pencil className="size-3.5" />
            Ubah
          </Button>
        ) : null}
        {izin.hapus ? (
          <DialogKonfirmasi
            pemicu={
              <Button
                type="button"
                variant="outline"
                className="tekan-halus sentuh-nyaman h-7 rounded-full px-2.5 text-[11px] font-semibold text-danger-text"
              >
                <Trash2 className="size-3.5" />
                Hapus
              </Button>
            }
            judul={`Hapus ${penjual.namaToko}?`}
            pesan="Catatan dan riwayat kesepakatannya ikut hilang. Mitra yang pernah bekerja sama lebih baik ditandai nonaktif daripada dihapus."
            labelYa="Hapus mitra"
            berbahaya
            onSetuju={() => hapusPenjual(penjual.id)}
          />
        ) : null}
      </div>

      {izin.ubah ? (
        <DialogUbahPenjual
          penjual={penjual}
          pilihan={pilihan}
          anggota={anggota}
          unitTerkunci={unitTerkunci}
          buka={ubah}
          onBuka={setUbah}
        />
      ) : null}
    </li>
  );
}
