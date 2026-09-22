"use client";

import { useState, useTransition } from "react";
import { Loader2, MessageSquare, Send, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { jamWib, tanggalPendek } from "@/lib/format";
import { balasMasukan, ubahDukungan } from "@/app/actions/masukan";
import type { Masukan } from "@/lib/masukan";

/** Balasan dan dukungan pada sebuah masukan. */
export function BalasanMasukan({ masukan }: { masukan: Masukan }) {
  const [isi, setIsi] = useState("");
  const [mengirim, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  const kirim = () => {
    if (isi.trim().length < 2 || mengirim) return;
    mulai(async () => {
      setPesan(null);
      const hasil = await balasMasukan({ masukanId: masukan.id, isi });
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
      if (hasil.ok) setIsi("");
    });
  };

  const dukung = () =>
    mulai(async () => {
      setPesan(null);
      const hasil = await ubahDukungan({
        masukanId: masukan.id,
        dukung: !masukan.sayaDukung,
      });
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
    });

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <MessageSquare className="size-4 text-muted-foreground" />
          Balasan
        </h2>

        <Button
          type="button"
          variant={masukan.sayaDukung ? "default" : "outline"}
          disabled={mengirim}
          onClick={dukung}
          className="tekan-halus sentuh-nyaman h-9 shrink-0 rounded-full px-4 text-[11px] font-semibold"
        >
          <ThumbsUp className="size-3.5" />
          {masukan.sayaDukung ? "Kamu mendukung" : "Dukung"} ·{" "}
          {masukan.dukungan}
        </Button>
      </div>

      {masukan.komentar.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada balasan.
        </p>
      ) : (
        <ul className="space-y-2 px-5">
          {masukan.komentar.map((k) => (
            <li key={k.id} className="rounded-2xl bg-muted/50 p-3">
              <p className="text-[13px] leading-[18px] text-pretty">{k.isi}</p>
              <p className="mt-1 text-[11px] leading-[14px] text-muted-foreground">
                {k.olehNama ?? "Anonim"} · {tanggalPendek(k.pada)}{" "}
                {jamWib(k.pada)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 px-5">
        <textarea
          value={isi}
          maxLength={1000}
          rows={2}
          aria-label="Tulis balasan"
          onChange={(e) => setIsi(e.target.value)}
          placeholder="Tulis balasan…"
          className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <Button
          type="button"
          disabled={isi.trim().length < 2 || mengirim}
          onClick={kirim}
          className="tekan-halus sentuh-nyaman h-10 rounded-full px-4 text-[11px] font-semibold"
        >
          {mengirim ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          Kirim balasan
        </Button>
      </div>

      {pesan ? (
        <p
          role="status"
          className={cn(
            "mx-5 rounded-2xl px-4 py-2.5 text-[11px] leading-[14px] text-pretty",
            berhasil
              ? "bg-ok-fill text-ok-text"
              : "bg-warn-fill text-warn-text",
          )}
        >
          {pesan}
        </p>
      ) : null}
    </Card>
  );
}
