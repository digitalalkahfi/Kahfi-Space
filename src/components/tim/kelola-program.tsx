"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PesanAksi } from "@/components/shared/pesan-aksi";
import { cn } from "@/lib/utils";
import { bilangan } from "@/lib/format";
import { gayaUnit } from "@/lib/unit";
import { DAFTAR_UNIT } from "@/lib/unit-pelaporan";
import { tambahProgram, ubahStatusProgram } from "@/app/actions/program";
import type { Hasil } from "@/lib/data/hasil";
import type { ProgramKelola } from "@/lib/data/program";

/**
 * Pengelolaan program: menambah, menonaktifkan, dan menghidupkan lagi.
 *
 * Program tidak pernah dihapus. Anggota dan akun yang pernah memakainya
 * tetap menunjuk baris yang sama, jadi menghapusnya akan memutus
 * riwayat mereka — yang nonaktif cukup hilang dari pilihan form.
 */
export function KelolaProgram({
  daftar,
  bolehKelola,
}: {
  daftar: ProgramKelola[];
  bolehKelola: boolean;
}) {
  const [nama, setNama] = useState("");
  const [unit, setUnit] = useState<string>(DAFTAR_UNIT[0].kode);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(
    null,
  );

  const jalankan = (aksi: () => Promise<Hasil>) => {
    if (menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await aksi();
      setPesan({ ok: hasil.ok, teks: hasil.pesan ?? "Tersimpan." });
      if (hasil.ok) setNama("");
    });
  };

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-1 px-5">
        <h2 className="text-base leading-6 font-semibold">Program</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Program menempel pada satu unit. Nama yang sama boleh ada di unit
          berbeda — &quot;Reguler&quot; di Affiliator dan di MCN memang dua hal
          berbeda.
        </p>
      </div>

      {pesan ? (
        <div className="px-5">
          <PesanAksi nada={pesan.ok ? "berhasil" : "gagal"} ukuran="sedang">
            {pesan.teks}
          </PesanAksi>
        </div>
      ) : null}

      <ul className="space-y-1.5 px-5">
        {daftar.map((p) => (
          <li
            key={p.id}
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl bg-muted/50 px-3 py-2",
              !p.aktif && "opacity-70",
            )}
          >
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                p.unitKode ? gayaUnit[p.unitKode].bar : "bg-border",
              )}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-[13px] leading-[18px] font-semibold">
                  {p.nama}
                </span>
                {!p.aktif ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-muted-foreground">
                    nonaktif
                  </span>
                ) : null}
              </span>
              <span className="tabular block truncate text-[11px] leading-[14px] text-muted-foreground">
                {p.unitNama} · {bilangan(p.jumlahAnggota)} anggota ·{" "}
                {bilangan(p.jumlahAkun)} akun
              </span>
            </span>

            {bolehKelola ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={menyimpan}
                onClick={() =>
                  jalankan(() =>
                    ubahStatusProgram({ programId: p.id, aktif: !p.aktif }),
                  )
                }
                className="tekan-halus sentuh-nyaman h-7 shrink-0 rounded-full px-3 text-[11px] font-semibold"
              >
                <Power className="size-3" />
                {p.aktif ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            ) : null}
          </li>
        ))}

        {daftar.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-border-subtle px-3 py-6 text-center text-[11px] leading-[14px] text-muted-foreground">
            Belum ada program sama sekali.
          </li>
        ) : null}
      </ul>

      {bolehKelola ? (
        <form
          className="flex flex-wrap items-end gap-2 px-5"
          onSubmit={(e) => {
            e.preventDefault();
            jalankan(() => tambahProgram({ nama, unitKode: unit }));
          }}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="nama-program">Program baru</Label>
            <Input
              id="nama-program"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="mis. Mabit Scholar"
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unit-program">Unit</Label>
            <select
              id="unit-program"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="sentuh-nyaman h-9 rounded-2xl bg-card px-3 text-[13px] leading-[18px] ring-1 ring-border-subtle"
            >
              {DAFTAR_UNIT.map((u) => (
                <option key={u.kode} value={u.kode}>
                  {u.nama}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            disabled={menyimpan || nama.trim().length < 3}
            className="tekan-halus h-9 shrink-0 rounded-full"
          >
            {menyimpan ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Tambah
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
