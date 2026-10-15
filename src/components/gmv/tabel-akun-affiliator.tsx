"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, CircleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen, rupiahRingkas } from "@/lib/format";
import {
  URUT_BAWAAN,
  totalAkun,
  urutkanAkun,
  type BarisAkunAffiliator,
  type KolomUrut,
} from "@/lib/akun-affiliator";

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
}: {
  baris: BarisAkunAffiliator[];
}) {
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
                    {b.username}
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
                  </td>
                  <td className="tabular py-2.5 pr-3 text-right font-semibold">
                    {rupiahRingkas(b.komisi)}
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
        <label className="flex items-center justify-between gap-2 text-[12px] leading-4 text-muted-foreground">
          Urutkan
          <select
            value={`${urut.kolom}:${urut.arah}`}
            onChange={(e) => {
              const [kolom, arah] = e.target.value.split(":");
              setUrut({
                kolom: kolom as KolomUrut,
                arah: arah as "naik" | "turun",
              });
            }}
            className="h-9 rounded-xl bg-muted px-3 text-[12px] text-foreground outline-none"
          >
            <option value="gmv:turun">GMV terbesar</option>
            <option value="komisi:turun">Komisi terbesar</option>
            <option value="totalUpload:turun">Upload terbanyak</option>
            <option value="kepatuhan:naik">Kepatuhan terendah</option>
            <option value="username:naik">Nama akun A–Z</option>
          </select>
        </label>
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
                    {b.username}
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
                </dd>
                <dt className="text-muted-foreground">Komisi</dt>
                <dd className="tabular text-right font-semibold">
                  {rupiahRingkas(b.komisi)}
                </dd>
                <dt className="text-muted-foreground">
                  Upload (rata/hari vs min.)
                </dt>
                <dd className="tabular text-right">
                  {ANGKA.format(b.totalUpload)} ({teksRata(b)})
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
