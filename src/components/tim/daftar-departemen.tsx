"use client";

import { useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bilangan } from "@/lib/format";
import type { BarisDepartemen } from "@/lib/organisasi";
import type { AnggotaTim } from "@/lib/types";

/**
 * Daftar departemen yang bisa dibuka satu per satu.
 *
 * Tabel susunan menjawab "ada departemen apa saja"; pertanyaan
 * berikutnya selalu "siapa saja di dalamnya" — dan itu tidak muat di
 * kolom tabel. Dibuka satu per satu, bukan semuanya sekaligus: daftar
 * berisi dua puluh lima nama di atas tabel membuat tabelnya sendiri
 * tidak lagi bisa dibaca sebagai ringkasan.
 */
export function DaftarDepartemen({
  daftar,
  anggota,
}: {
  daftar: BarisDepartemen[];
  anggota: AnggotaTim[];
}) {
  const [buka, setBuka] = useState<string | null>(null);

  if (daftar.length === 0) return null;

  const isiDepartemen = (nama: string) =>
    anggota
      .filter((a) => a.status === "aktif" && a.departemen === nama)
      .sort((x, y) => x.nama.localeCompare(y.nama));

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">Departemen</h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Buka satu departemen untuk melihat siapa saja di dalamnya.
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <Building2 className="size-4" />
        </span>
      </div>

      <ul className="space-y-1.5 px-5">
        {daftar.map((d) => {
          const terbuka = buka === d.nama;
          const isi = terbuka ? isiDepartemen(d.nama) : [];
          return (
            <li key={d.nama} className="rounded-2xl bg-muted/50">
              <button
                type="button"
                onClick={() => setBuka(terbuka ? null : d.nama)}
                aria-expanded={terbuka}
                className="tekan-halus sentuh-nyaman flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                    terbuka && "rotate-180",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-[18px] font-semibold">
                    {d.nama}
                  </span>
                  <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                    {d.penanggungJawab ?? "Belum ada penanggung jawab"}
                    {d.unit.length > 0 ? ` · ${d.unit.join(", ")}` : ""}
                  </span>
                </span>
                <span className="tabular shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px] leading-[14px] font-semibold text-muted-foreground ring-1 ring-border-subtle">
                  {bilangan(d.jumlahAktif)} orang
                </span>
              </button>

              {terbuka ? (
                <div className="px-3 pb-3">
                  {isi.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border-subtle px-3 py-3 text-center text-[11px] leading-[14px] text-muted-foreground">
                      Departemen ini belum punya anggota aktif.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {isi.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center gap-2 rounded-xl bg-card px-2.5 py-1.5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] leading-[18px] font-medium">
                              {a.nama}
                            </span>
                            <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                              {a.jabatan}
                              {a.program ? ` · ${a.program}` : ""}
                            </span>
                          </span>
                          {/* Jumlah akun yang dipegang ikut di sini:
                              itulah beban nyata seorang PIC, dan tidak
                              terlihat dari jabatannya. */}
                          {a.akunDipegang > 0 ? (
                            <span className="tabular shrink-0 text-[11px] leading-[14px] text-muted-foreground">
                              {bilangan(a.akunDipegang)} akun
                            </span>
                          ) : null}
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-muted-foreground">
                            {a.role}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
