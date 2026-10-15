"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CircleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen, rupiahRingkas } from "@/lib/format";
import {
  URUT_BAWAAN,
  perubahan,
  totalAkun,
  urutkanAkun,
  type BarisAkunAffiliator,
  type KolomUrut,
} from "@/lib/akun-affiliator";

/** Pilihan urutan; sama untuk layar lebar dan HP. */
const PILIHAN_URUT: { nilai: string; label: string }[] = [
  { nilai: "gmv:turun", label: "GMV terbesar" },
  // §4: akun yang perlu perhatian langsung terlihat di atas.
  { nilai: "perubahanGmv:naik", label: "Turun terbanyak" },
  { nilai: "komisi:turun", label: "Komisi terbesar" },
  { nilai: "totalUpload:turun", label: "Upload terbanyak" },
  { nilai: "kepatuhan:naik", label: "Kepatuhan terendah" },
  { nilai: "username:naik", label: "Nama akun A–Z" },
];

const WARNA_PERUBAHAN = {
  naik: "text-ok-text",
  turun: "text-danger-text",
  tetap: "text-muted-foreground",
  baru: "text-info-text",
  kosong: "text-muted-foreground",
} as const;

/** "▲ 12,4%" / "▼ 8,1%" / "= 0%" / "Baru" / "—" di bawah sebuah angka. */
function Perubahan({
  sekarang,
  sebelumnya,
  pembanding,
}: {
  sekarang: number;
  sebelumnya: number | undefined;
  pembanding: string;
}) {
  if (sebelumnya === undefined) return null;
  const p = perubahan(sekarang, sebelumnya);
  return (
    <span
      title={`vs ${pembanding}`}
      className={cn(
        "tabular block text-[11px] leading-[14px] font-semibold",
        WARNA_PERUBAHAN[p.arah],
      )}
    >
      {p.teks}
    </span>
  );
}

const ANGKA = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

const KOLOM: { kunci: KolomUrut; label: string; kanan?: boolean }[] = [
  { kunci: "username", label: "Akun" },
  { kunci: "picNama", label: "PIC" },
  { kunci: "level", label: "Level", kanan: true },
  { kunci: "totalUpload", label: "Upload", kanan: true },
  { kunci: "rataUpload", label: "Rata/hari vs min.", kanan: true },
  { kunci: "kepatuhan", label: "Kepatuhan", kanan: true },
  { kunci: "gmv", label: "GMV", kanan: true },
  { kunci: "komisi", label: "Komisi", kanan: true },
  { kunci: "hariLapor", label: "Lapor / kerja", kanan: true },
];

function teksKepatuhan(b: BarisAkunAffiliator) {
  return b.kepatuhan === null ? "belum dinilai" : persen(b.kepatuhan);
}

function teksRata(b: BarisAkunAffiliator) {
  const rata = b.rataUpload === null ? "—" : ANGKA.format(b.rataUpload);
  return b.minimum === null ? rata : `${rata} / ${b.minimum}`;
}

/**
 * Tabel per akun Affiliator: bisa diurutkan per kolom (bawaan GMV
 * terbesar), baris Total di atas, kartu per akun di HP.
 */
export function TabelAkunAffiliator({
  baris,
  pembanding,
  kueriPeriode,
}: {
  baris: BarisAkunAffiliator[];
  /** Nama periode pembanding, untuk keterangan penanda naik/turun. */
  pembanding: string;
  /** Parameter periode dasbor, dibawa ke halaman detail akun. */
  kueriPeriode: string;
}) {
  const tautan = (id: string) =>
    `/akun/${id}?${new URLSearchParams([
      ...new URLSearchParams(kueriPeriode),
      ["asal", "gmv"],
    ])}`;
  // Baris "Laporan tingkat unit" bukan akun, jadi tidak punya halaman.
  const NamaAkun = ({ b }: { b: BarisAkunAffiliator }) =>
    b.id === "laporan-unit" ? (
      <>{b.username}</>
    ) : (
      <Link
        href={tautan(b.id)}
        className="tekan-halus text-primary underline-offset-2 hover:underline"
      >
        {b.username}
      </Link>
    );
  const pilihUrut = (nilai: string) => {
    const [kolom, arah] = nilai.split(":");
    setUrut({ kolom: kolom as KolomUrut, arah: arah as "naik" | "turun" });
  };
  const [urut, setUrut] = useState(URUT_BAWAAN);
  const daftar = urutkanAkun(baris, urut.kolom, urut.arah);
  const total = totalAkun(baris);

  const ganti = (kolom: KolomUrut) =>
    setUrut((u) =>
      u.kolom === kolom
        ? { kolom, arah: u.arah === "turun" ? "naik" : "turun" }
        : {
            kolom,
            arah:
              kolom === "username" || kolom === "picNama" ? "naik" : "turun",
          },
    );

  if (baris.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada laporan Affiliator di periode ini.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <dl className="grid grid-cols-3 gap-2 px-5">
          {[
            { label: "Total upload", nilai: ANGKA.format(total.upload) },
            { label: "Total GMV", nilai: rupiahRingkas(total.gmv) },
            { label: "Total komisi", nilai: rupiahRingkas(total.komisi) },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl bg-muted/60 p-3">
              <dt className="text-[11px] leading-[14px] text-muted-foreground">
                {k.label}
              </dt>
              <dd className="tabular mt-0.5 text-base leading-6 font-bold tracking-tight">
                {k.nilai}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] leading-4 text-muted-foreground">
        <span>▲/▼ dibanding {pembanding}. Klik nama akun untuk grafiknya.</span>
        <label className="flex items-center gap-2">
          Urutkan
          <select
            value={`${urut.kolom}:${urut.arah}`}
            onChange={(e) => pilihUrut(e.target.value)}
            className="h-9 rounded-xl bg-muted px-3 text-[12px] text-foreground outline-none"
          >
            {/* Urutan per kolom dari judul tabel tetap bisa dipakai;
                pilihan yang tidak ada di daftar ini ditampilkan apa adanya. */}
            {PILIHAN_URUT.some(
              (p) => p.nilai === `${urut.kolom}:${urut.arah}`,
            ) ? null : (
              <option value={`${urut.kolom}:${urut.arah}`}>Sesuai kolom</option>
            )}
            {PILIHAN_URUT.map((p) => (
              <option key={p.nilai} value={p.nilai}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Layar lebar: tabel yang bisa diurutkan. */}
      <Card className="hidden rounded-3xl shadow-card ring-border-subtle md:block">
        <div className="overflow-x-auto px-5">
          <table className="w-full text-[13px] leading-[18px]">
            <thead>
              <tr>
                {KOLOM.map((k) => {
                  const aktif = urut.kolom === k.kunci;
                  return (
                    <th
                      key={k.kunci}
                      scope="col"
                      aria-sort={
                        aktif
                          ? urut.arah === "naik"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className={cn(
                        "pb-2 font-semibold",
                        k.kanan ? "text-right" : "text-left",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => ganti(k.kunci)}
                        className={cn(
                          "tekan-halus inline-flex items-center gap-1 text-[11px] leading-[14px]",
                          aktif ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {k.label}
                        {aktif ? (
                          urut.arah === "naik" ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {daftar.map((b) => (
                <tr
                  key={b.id}
                  className={cn(
                    "border-t border-border-subtle",
                    b.tanpaLaporan && "bg-danger-fill/40",
                  )}
                >
                  <th
                    scope="row"
                    className="py-2.5 pr-3 text-left font-semibold"
                  >
                    <NamaAkun b={b} />
                    <span className="block text-[11px] leading-[14px] font-normal">
                      {b.aktif ? (
                        b.tanpaLaporan ? (
                          <span className="inline-flex items-center gap-1 text-danger-text">
                            <CircleAlert className="size-3" />
                            Tanpa laporan
                          </span>
                        ) : (
                          <span className="text-ok-text">Aktif</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">Nonaktif</span>
                      )}
                    </span>
                  </th>
                  <td className="py-2.5 pr-3">{b.picNama ?? "—"}</td>
                  <td className="tabular py-2.5 pr-3 text-right">
                    {b.level ?? "—"}
                  </td>
                  <td className="tabular py-2.5 pr-3 text-right">
                    {ANGKA.format(b.totalUpload)}
                    <Perubahan
                      sekarang={b.totalUpload}
                      sebelumnya={b.sebelum?.upload}
                      pembanding={pembanding}
                    />
                  </td>
                  <td className="tabular py-2.5 pr-3 text-right">
                    {teksRata(b)}
                  </td>
                  <td
                    className={cn(
                      "tabular py-2.5 pr-3 text-right",
                      b.kepatuhan === null && "text-muted-foreground",
                    )}
                  >
                    {teksKepatuhan(b)}
                  </td>
                  <td className="tabular py-2.5 pr-3 text-right font-semibold">
                    {rupiahRingkas(b.gmv)}
                    <Perubahan
                      sekarang={b.gmv}
                      sebelumnya={b.sebelum?.gmv}
                      pembanding={pembanding}
                    />
                  </td>
                  <td className="tabular py-2.5 pr-3 text-right font-semibold">
                    {rupiahRingkas(b.komisi)}
                    <Perubahan
                      sekarang={b.komisi}
                      sebelumnya={b.sebelum?.komisi}
                      pembanding={pembanding}
                    />
                  </td>
                  <td className="tabular py-2.5 text-right">
                    {b.hariLapor} / {b.hariKerja}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* HP: kartu per akun (§4.4). */}
      <div className="space-y-2 md:hidden">
        <ul className="space-y-2">
          {daftar.map((b) => (
            <li
              key={b.id}
              className={cn(
                "space-y-2 rounded-3xl bg-card p-4 ring-1 ring-border-subtle",
                b.tanpaLaporan && "ring-danger/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm leading-5 font-semibold">
                    <NamaAkun b={b} />
                  </p>
                  <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
                    {b.picNama ?? "Tanpa PIC"} · Level {b.level ?? "—"}
                    {b.aktif ? "" : " · Nonaktif"}
                  </p>
                </div>
                {b.tanpaLaporan ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-fill px-2 py-0.5 text-[11px] font-semibold text-danger-text">
                    <CircleAlert className="size-3" />
                    Tanpa laporan
                  </span>
                ) : null}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] leading-4">
                <dt className="text-muted-foreground">GMV</dt>
                <dd className="tabular text-right font-semibold">
                  {rupiahRingkas(b.gmv)}
                  <Perubahan
                    sekarang={b.gmv}
                    sebelumnya={b.sebelum?.gmv}
                    pembanding={pembanding}
                  />
                </dd>
                <dt className="text-muted-foreground">Komisi</dt>
                <dd className="tabular text-right font-semibold">
                  {rupiahRingkas(b.komisi)}
                  <Perubahan
                    sekarang={b.komisi}
                    sebelumnya={b.sebelum?.komisi}
                    pembanding={pembanding}
                  />
                </dd>
                <dt className="text-muted-foreground">
                  Upload (rata/hari vs min.)
                </dt>
                <dd className="tabular text-right">
                  {ANGKA.format(b.totalUpload)} ({teksRata(b)})
                  <Perubahan
                    sekarang={b.totalUpload}
                    sebelumnya={b.sebelum?.upload}
                    pembanding={pembanding}
                  />
                </dd>
                <dt className="text-muted-foreground">Kepatuhan</dt>
                <dd className="tabular text-right">{teksKepatuhan(b)}</dd>
                <dt className="text-muted-foreground">Hari lapor / kerja</dt>
                <dd className="tabular text-right">
                  {b.hariLapor} / {b.hariKerja}
                </dd>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
