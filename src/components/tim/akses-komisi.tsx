"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coins, History, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PesanAksi,
  nadaHasil,
  type NadaPesan,
} from "@/components/shared/pesan-aksi";
import { cn } from "@/lib/utils";
import { jamWib, tanggalPendek } from "@/lib/format";
import { aturAksesKomisi } from "@/app/actions/akses-komisi";
import {
  PILIHAN_AKSES_KOMISI,
  labelAksesKomisi,
  type PilihanAksesKomisi,
} from "@/lib/komisi";
import type {
  AksesKomisiAnggota,
  RiwayatAksesKomisi,
} from "@/lib/data/akses-komisi";
import type { PotretAksesKomisi } from "@/lib/supabase/types";

function teksPotret(p: PotretAksesKomisi): string {
  if (!p) return "Tidak ada";
  const label = labelAksesKomisi(p.cakupan);
  return p.cakupan === "tertentu"
    ? `${label}: ${p.akun.map((a) => a.username).join(", ")}`
    : label;
}

/**
 * Bagian "Akses lihat komisi" di kartu anggota (§4.5) — hanya dirender
 * untuk CEO/Manager. Mengisi komisi tidak berarti boleh melihatnya (K5);
 * di sinilah satu-satunya tempat hak melihat itu diberikan.
 */
export function AksesKomisi({
  userId,
  nama,
  akses,
  riwayat,
  akunAffiliator,
}: {
  userId: string;
  nama: string;
  akses: AksesKomisiAnggota;
  riwayat: RiwayatAksesKomisi[];
  akunAffiliator: { id: string; username: string; aktif: boolean }[];
}) {
  const router = useRouter();
  const awal: PilihanAksesKomisi = akses.cakupan ?? "tidak";
  const [pilihan, setPilihan] = useState<PilihanAksesKomisi>(awal);
  const [akun, setAkun] = useState<string[]>(akses.akunIds);
  const [pesan, setPesan] = useState<string | null>(null);
  const [nada, setNada] = useState<NadaPesan>("netral");
  const [menyimpan, mulai] = useTransition();

  const berubah =
    pilihan !== awal ||
    (pilihan === "tertentu" &&
      (akun.length !== akses.akunIds.length ||
        akun.some((a) => !akses.akunIds.includes(a))));
  const siap = berubah && (pilihan !== "tertentu" || akun.length > 0);

  const simpan = () =>
    mulai(async () => {
      setPesan(null);
      const hasil = await aturAksesKomisi(userId, pilihan, akun);
      setNada(nadaHasil(hasil));
      setPesan(hasil.ok ? (hasil.pesan ?? "Tersimpan.") : hasil.pesan);
      if (hasil.ok) router.refresh();
    });

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-3 px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base leading-6 font-semibold">
              Akses lihat komisi
            </h2>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              {nama} tetap wajib mengisi komisi saat melapor akun Affiliator.
              Pilihan di sini menentukan angka komisi mana yang boleh ia lihat
              kembali. Kartu total Komisi tetap hanya untuk CEO dan Manager.
            </p>
          </div>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warn-fill text-warn-text">
            <Coins className="size-4" />
          </span>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="sr-only">Cakupan akses lihat komisi</legend>
          {PILIHAN_AKSES_KOMISI.map((p) => (
            <label
              key={p.nilai}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1",
                pilihan === p.nilai
                  ? "bg-primary/5 ring-primary/40"
                  : "bg-muted/40 ring-transparent",
              )}
            >
              <input
                type="radio"
                name={`akses-komisi-${userId}`}
                value={p.nilai}
                checked={pilihan === p.nilai}
                onChange={() => setPilihan(p.nilai)}
                className="mt-1"
              />
              <span>
                <span className="block text-[13px] leading-[18px] font-semibold">
                  {p.label}
                </span>
                <span className="block text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  {p.keterangan}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {pilihan === "tertentu" ? (
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Akun yang boleh dilihat komisinya
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {akunAffiliator.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-[13px] leading-[18px]"
                >
                  <input
                    type="checkbox"
                    checked={akun.includes(a.id)}
                    onChange={(e) =>
                      setAkun((lama) =>
                        e.target.checked
                          ? [...lama, a.id]
                          : lama.filter((x) => x !== a.id),
                      )
                    }
                  />
                  <span className="truncate">{a.username}</span>
                  {a.aktif ? null : (
                    <span className="text-[11px] text-muted-foreground">
                      nonaktif
                    </span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            {akses.cakupan
              ? `Sekarang: ${labelAksesKomisi(akses.cakupan)}${
                  akses.diberiOleh ? ` · diberi ${akses.diberiOleh}` : ""
                }${akses.diberiPada ? `, ${tanggalPendek(akses.diberiPada)}` : ""}`
              : "Sekarang: tidak ada akses"}
          </p>
          <Button
            type="button"
            disabled={!siap || menyimpan}
            onClick={simpan}
            className="tekan-halus h-9 rounded-full px-4 text-[12px] font-semibold"
          >
            {menyimpan ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Simpan akses
          </Button>
        </div>

        {pesan ? <PesanAksi nada={nada}>{pesan}</PesanAksi> : null}

        {riwayat.length > 0 ? (
          <div className="space-y-1.5 border-t border-border-subtle pt-3">
            <p className="flex items-center gap-1.5 text-[12px] leading-4 font-semibold">
              <History className="size-3.5" />
              Riwayat perubahan akses
            </p>
            <ul className="space-y-1.5">
              {riwayat.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl bg-muted/40 px-3 py-2 text-[12px] leading-4"
                >
                  <span className="block text-pretty">
                    {teksPotret(r.sebelum)} →{" "}
                    <strong>{teksPotret(r.sesudah)}</strong>
                  </span>
                  <span className="block text-[11px] leading-[14px] text-muted-foreground">
                    {r.oleh} · {tanggalPendek(r.pada)} {jamWib(r.pada)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
