"use client";

import { useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Batas wajar satu laporan harian; menahan salah ketik nol berlebih. */
export const MAKS_GMV = 100_000_000_000;

/** Hanya sisakan digit — menerima "Rp 5.250.000", "5,250,000", "5 250 000". */
export function hanyaDigit(teks: string) {
  return teks.replace(/\D/g, "");
}

export function formatRibuan(digit: string) {
  if (!digit) return "";
  return Number(digit).toLocaleString("id-ID");
}

/**
 * Input GMV: angka diketik manual sambil melihat Partner Center, otomatis
 * diberi pemisah ribuan. Posisi kursor dipertahankan saat menyunting di
 * tengah teks, jadi memperbaiki satu digit tidak melempar kursor ke ujung.
 */
export function InputGmv({
  id = "gmv",
  nilai,
  onUbah,
  maks = MAKS_GMV,
  suffix,
  className,
}: {
  id?: string;
  /** Nilai dalam rupiah penuh. */
  nilai: number;
  onUbah: (nilai: number) => void;
  maks?: number;
  suffix?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
  const [teks, setTeks] = useState(() =>
    nilai > 0 ? formatRibuan(String(nilai)) : "",
  );

  // Kembalikan kursor ke posisi yang setara setelah pemisah ribuan disisipkan.
  useLayoutEffect(() => {
    const el = ref.current;
    const posisi = caretRef.current;
    if (!el || posisi === null) return;
    el.setSelectionRange(posisi, posisi);
    caretRef.current = null;
  }, [teks]);

  const tangani = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caretLama = el.selectionStart ?? el.value.length;
    // Berapa digit yang berada di kiri kursor — itu jangkar yang stabil.
    const digitKiri = hanyaDigit(el.value.slice(0, caretLama)).length;

    let digit = hanyaDigit(el.value);
    if (digit && Number(digit) > maks) digit = String(maks);

    const baru = formatRibuan(digit);
    setTeks(baru);
    onUbah(digit ? Number(digit) : 0);

    // Cari ulang posisi setelah sekian digit pada teks yang sudah diformat.
    let hitung = 0;
    let posisi = baru.length;
    for (let i = 0; i < baru.length; i += 1) {
      if (/\d/.test(baru[i])) hitung += 1;
      if (hitung === digitKiri) {
        posisi = i + 1;
        break;
      }
    }
    caretRef.current = digitKiri === 0 ? 0 : posisi;
  };

  const kosongkan = () => {
    setTeks("");
    onUbah(0);
    ref.current?.focus();
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl bg-muted px-4 py-3 focus-within:ring-2 focus-within:ring-ring/40",
        className,
      )}
    >
      <span className="shrink-0 text-[20px] leading-7 font-semibold text-muted-foreground">
        Rp
      </span>

      <input
        ref={ref}
        id={id}
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="done"
        placeholder="0"
        aria-describedby={`${id}-bantuan`}
        value={teks}
        onChange={tangani}
        className="tabular w-full min-w-0 bg-transparent text-[22px] leading-7 font-bold tracking-tight outline-none placeholder:text-muted-foreground/60"
      />

      {teks ? (
        <button
          type="button"
          onClick={kosongkan}
          aria-label="Kosongkan nilai GMV"
          className="tekan-halus sentuh-nyaman flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}

      {suffix}
    </div>
  );
}
