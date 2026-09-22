"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, Pencil, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DialogUbahSampel } from "@/components/sampel/dialog-sampel";
import { TombolHapusSampel } from "@/components/sampel/tombol-hapus-sampel";
import { KeadaanKosong } from "@/components/shared/keadaan";
import { cn } from "@/lib/utils";
import { rupiahRingkas, tanggalRelatif } from "@/lib/format";
import {
  GAYA_STATUS_SAMPEL,
  LABEL_STATUS_SAMPEL,
  ringkasSampel,
  type Sampel,
} from "@/lib/sampel";
import type { PilihanOrganisasi } from "@/lib/types";

/** Angka yang menjawab "berapa nilai barang yang sedang tidak di gudang". */
export function RingkasanSampel({
  daftar,
  acuan,
}: {
  daftar: Sampel[];
  acuan: string;
}) {
  const r = ringkasSampel(daftar);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <Package className="size-4 text-muted-foreground" />
          Sampel produk
        </h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          {r.total} sampel tercatat per {tanggalRelatif(acuan, acuan)}
        </p>
      </div>

      <dl className="tabular grid grid-cols-2 gap-2 px-5">
        <div className="rounded-2xl bg-muted/50 p-3">
          <dt className="text-[11px] leading-[14px] text-muted-foreground">
            Sedang di luar gudang
          </dt>
          <dd className="text-lg leading-6 font-bold tracking-tight">
            {r.diLuar}
          </dd>
          <dd className="text-[11px] leading-[14px] text-muted-foreground">
            senilai {rupiahRingkas(r.nilaiDiLuar)}
          </dd>
        </div>

        <div
          className={cn(
            "rounded-2xl p-3",
            r.hilang > 0 ? "bg-danger-fill" : "bg-muted/50",
          )}
        >
          <dt
            className={cn(
              "text-[11px] leading-[14px]",
              r.hilang > 0 ? "text-danger-text" : "text-muted-foreground",
            )}
          >
            Hilang
          </dt>
          <dd
            className={cn(
              "text-lg leading-6 font-bold tracking-tight",
              r.hilang > 0 && "text-danger-text",
            )}
          >
            {r.hilang}
          </dd>
          <dd
            className={cn(
              "text-[11px] leading-[14px]",
              r.hilang > 0 ? "text-danger-text" : "text-muted-foreground",
            )}
          >
            senilai {rupiahRingkas(r.nilaiHilang)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function BarisSampel({
  sampel: s,
  acuan,
  pilihan,
  bolehKelola,
}: {
  sampel: Sampel;
  acuan: string;
  pilihan: PilihanOrganisasi;
  bolehKelola: boolean;
}) {
  const [bukaUbah, setBukaUbah] = useState(false);
  const gaya = GAYA_STATUS_SAMPEL[s.status];

  return (
    <li className="rounded-2xl bg-muted/50 p-3.5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-2xl",
            s.status === "hilang"
              ? "bg-danger-fill text-danger-text"
              : "bg-card text-muted-foreground",
          )}
        >
          {s.status === "hilang" ? (
            <TriangleAlert className="size-4" />
          ) : (
            <Package className="size-4" />
          )}
        </span>

        <div className="min-w-[10rem] flex-1">
          <p className="truncate text-sm leading-5 font-semibold">
            <Link
              href={`/sampel/${encodeURIComponent(s.kode)}`}
              className="hover:underline"
            >
              {s.nama}
            </Link>
          </p>
          <p className="truncate font-mono text-[11px] leading-[14px] text-muted-foreground">
            {s.kode}
          </p>
          <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
            {s.kategori} · {s.unitNama} · {rupiahRingkas(s.nilai)}
            {s.akunUsername ? ` · ${s.akunUsername}` : ""}
          </p>
        </div>

        <span
          className={cn(
            "inline-flex h-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
            gaya.kelas,
          )}
        >
          <span className={cn("size-1.5 rounded-full", gaya.titik)} />
          {LABEL_STATUS_SAMPEL[s.status]}
        </span>

        {bolehKelola ? (
          <>
            <Button
              type="button"
              variant="ghost"
              aria-label={`Ubah ${s.kode}`}
              onClick={() => setBukaUbah(true)}
              className="tekan-halus sentuh-nyaman size-8 shrink-0 rounded-full p-0"
            >
              <Pencil className="size-3.5" />
            </Button>

            {s.status === "tersedia" ? (
              <TombolHapusSampel sampelId={s.id} kode={s.kode} />
            ) : null}

            <DialogUbahSampel
              sampel={s}
              pilihan={pilihan}
              buka={bukaUbah}
              onBuka={setBukaUbah}
            />
          </>
        ) : null}
      </div>

      <p className="mt-2 text-[11px] leading-[14px] text-pretty text-muted-foreground">
        {s.pemegangNama
          ? `Dipegang ${s.pemegangNama}`
          : s.kreator
            ? s.kreator
            : "Ada di gudang"}
        {" · terakhir berpindah "}
        {tanggalRelatif(s.diperbaruiPada, acuan)}
      </p>
    </li>
  );
}

/** Daftar sampel beserta keadaan dan pemegangnya sekarang. */
export function DaftarSampel({
  daftar,
  acuan,
  pilihan,
  bolehKelola,
}: {
  daftar: Sampel[];
  acuan: string;
  pilihan: PilihanOrganisasi;
  bolehKelola: boolean;
}) {
  if (daftar.length === 0) {
    return (
      <KeadaanKosong
        ikon={<Package className="size-4" />}
        judul="Belum ada sampel yang terlihat untukmu"
        pesan="Sampel muncul di sini setelah dicatat dan masuk cakupan unitmu."
      />
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <h2 className="px-5 text-base leading-6 font-semibold">Daftar sampel</h2>

      <ul className="space-y-2 px-5">
        {daftar.map((s) => (
          <BarisSampel
            key={s.id}
            sampel={s}
            acuan={acuan}
            pilihan={pilihan}
            bolehKelola={bolehKelola}
          />
        ))}
      </ul>
    </Card>
  );
}
