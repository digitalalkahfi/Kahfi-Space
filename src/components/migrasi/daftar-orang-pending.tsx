"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, RefreshCw, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bilangan } from "@/lib/format";
import {
  abaikanOrang,
  segarkanOrangPending,
  tautkanOrang,
} from "@/app/actions/migrasi";
import type { OrangPending } from "@/lib/data/migrasi";
import { saranPadanan } from "@/lib/resolusi-orang";

/**
 * Orang V1 yang menunggu keputusan, beserta cara menautkannya.
 *
 * Yang ditampilkan lebih dulu bukan namanya melainkan berapa banyak data
 * yang menggantung padanya: itulah yang menentukan mana yang harus
 * diputuskan duluan. Satu orang yang menunjuk tiga ratus laporan jauh
 * lebih mendesak daripada sepuluh orang yang tidak menunjuk apa-apa.
 */
export function DaftarOrangPending({
  daftar,
  calon,
}: {
  daftar: OrangPending[];
  calon: { id: string; nama: string; email: string | null }[];
}) {
  const [menunggu, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);
  const [pilihan, setPilihan] = useState<Record<string, string>>({});

  const jalankan = (aksi: () => Promise<{ ok: boolean; pesan?: string }>) =>
    mulai(async () => {
      setPesan(null);
      const hasil = await aksi();
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
    });

  const [cari, setCari] = useState("");
  const kunci = cari.trim().toLowerCase();

  const belum = daftar
    .filter((o) => !o.userId && !o.diabaikan)
    .filter(
      (o) =>
        kunci === "" ||
        o.idLama.toLowerCase().includes(kunci) ||
        o.nama.toLowerCase().includes(kunci),
    );
  const sudah = daftar.filter((o) => o.userId || o.diabaikan);
  const semuaBelum = daftar.filter((o) => !o.userId && !o.diabaikan).length;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Orang yang menunggu keputusan
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {belum.length === 0
            ? "Tidak ada. Seluruh rujukan orang di data lama sudah punya padanan."
            : `${bilangan(belum.length)} orang di data lama belum punya padanan di V2. Selama belum diputuskan, data yang menunjuk mereka tidak diproses — laporan tanpa pelapor dan tugas tanpa penerima adalah data yang tampak utuh tetapi tidak bisa dipakai.`}
        </p>
      </div>

      <div className="px-5">
        <Button
          type="button"
          variant="outline"
          disabled={menunggu}
          onClick={() => jalankan(() => segarkanOrangPending())}
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          {menunggu ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Periksa ulang data lama
        </Button>
        <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
          Menelusuri seluruh kunci ekspor dan mencatat setiap rujukan orang yang
          belum punya padanan — tanpa menulis sebaris pun ke tabel tujuan.
        </p>
      </div>

      {semuaBelum > 8 ? (
        <div className="px-5">
          <label className="sr-only" htmlFor="cari-orang">
            Cari orang yang menunggu
          </label>
          <input
            id="cari-orang"
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari id atau nama…"
            className="sentuh-nyaman h-10 w-full rounded-full bg-card px-4 text-[13px] leading-[18px] ring-1 ring-border-subtle"
          />
          {kunci !== "" ? (
            <p className="mt-1 text-[11px] leading-[14px] text-muted-foreground">
              {belum.length} dari {semuaBelum} yang menunggu.
            </p>
          ) : null}
        </div>
      ) : null}

      {pesan ? (
        <p
          role="status"
          className={cn(
            "mx-5 rounded-2xl px-4 py-2.5 text-[13px] leading-[18px] text-pretty",
            berhasil
              ? "bg-ok-fill text-ok-text"
              : "bg-warn-fill text-warn-text",
          )}
        >
          {pesan}
        </p>
      ) : null}

      {belum.length > 0 ? (
        <ul className="space-y-1.5 px-5">
          {belum.map((o) => (
            <li key={o.idLama} className="rounded-2xl bg-muted/50 px-4 py-3">
              <p className="font-mono text-[11px] leading-[14px] break-all">
                {o.idLama}
              </p>
              {o.nama ? (
                <p className="text-[13px] leading-[18px] font-semibold">
                  {o.nama}
                </p>
              ) : null}
              <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                {o.alasan}
              </p>
              {o.jumlah > 0 ? (
                <p className="mt-0.5 inline-flex rounded-full bg-warn-fill px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-warn-text">
                  {bilangan(o.jumlah)} catatan menggantung
                </p>
              ) : null}
              {o.kemunculan.length > 0 ? (
                <p className="mt-0.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  Muncul di:{" "}
                  <span className="font-mono">{o.kemunculan.join(", ")}</span>
                </p>
              ) : null}

              {o.nama
                ? saranPadanan(o.nama, calon).map((sar) => (
                    <button
                      key={sar.id}
                      type="button"
                      disabled={menunggu}
                      onClick={() =>
                        setPilihan((p) => ({ ...p, [o.idLama]: sar.id }))
                      }
                      className="tekan-halus mt-1.5 mr-1.5 inline-flex rounded-full bg-info-fill px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-info-text"
                    >
                      mungkin {sar.nama}
                    </button>
                  ))
                : null}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`padanan-${o.idLama}`}>
                  Padanan untuk {o.idLama}
                </label>
                <select
                  id={`padanan-${o.idLama}`}
                  value={pilihan[o.idLama] ?? ""}
                  disabled={menunggu}
                  onChange={(e) =>
                    setPilihan((p) => ({ ...p, [o.idLama]: e.target.value }))
                  }
                  className="sentuh-nyaman h-10 min-w-0 flex-1 rounded-full bg-card px-4 text-[13px] leading-[18px] ring-1 ring-border-subtle"
                >
                  <option value="">Pilih orangnya di V2…</option>
                  {calon.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama}
                      {c.email ? ` · ${c.email}` : ""}
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  disabled={menunggu || !pilihan[o.idLama]}
                  onClick={() =>
                    jalankan(() => tautkanOrang(o.idLama, pilihan[o.idLama]))
                  }
                  className="tekan-halus sentuh-nyaman h-10 shrink-0 rounded-full px-4 text-[11px] font-semibold"
                >
                  {menunggu ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="size-3.5" />
                  )}
                  Tautkan
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={menunggu}
                  onClick={() => jalankan(() => abaikanOrang(o.idLama))}
                  className="tekan-halus sentuh-nyaman h-10 shrink-0 rounded-full px-4 text-[11px] font-semibold"
                >
                  <UserMinus className="size-3.5" />
                  Sengaja lewati
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {sudah.length > 0 ? (
        <div className="px-5">
          <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Sudah diputuskan
          </p>
          <ul className="mt-1.5 space-y-1">
            {sudah.map((o) => (
              <li
                key={o.idLama}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] leading-[14px]">
                  {o.idLama}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
                    o.diabaikan
                      ? "bg-muted text-muted-foreground"
                      : "bg-ok-fill text-ok-text",
                  )}
                >
                  {o.diabaikan ? null : <Check className="size-3" />}
                  {o.diabaikan
                    ? "sengaja dilewati"
                    : (calon.find((c) => c.id === o.userId)?.nama ??
                      "sudah tertaut")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={menunggu}
                  onClick={() => jalankan(() => tautkanOrang(o.idLama, null))}
                  className="tekan-halus h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold"
                >
                  Cabut
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
