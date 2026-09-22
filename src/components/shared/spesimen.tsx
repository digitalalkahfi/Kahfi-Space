import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Perkakas kecil untuk halaman /referensi-desain.
 *
 * Semua yang ada di halaman itu adalah *spesimen*: bentuknya persis
 * seperti aslinya, tetapi tidak menjalankan apa pun. Itu disengaja —
 * halaman rujukan tidak boleh berisi tombol yang kelihatan bisa ditekan
 * lalu tidak terjadi apa-apa. Karena itu spesimen dirender sebagai
 * <span>, bukan <button>, dan diberi aria-hidden supaya pembaca layar
 * tidak menawarkan sesuatu yang bukan kontrol.
 */

/** Satu bagian halaman rujukan: judul kecil + isi + keterangan singkat. */
export function Bagian({
  judul,
  keterangan,
  children,
}: {
  judul: string;
  keterangan?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {judul}
      </h2>
      {keterangan ? (
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {keterangan}
        </p>
      ) : null}
      {children}
    </section>
  );
}

/** Kartu pembungkus deretan spesimen. */
export function Petak({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className={cn("px-5", className)}>{children}</div>
    </Card>
  );
}

/** Contoh warna: kotak warna + nama token + nilainya. */
export function ContohWarna({
  kelas,
  kelasTeks,
  nama,
  nilai,
}: {
  /** Kelas latar Tailwind, mis. "bg-ok-fill". */
  kelas: string;
  /** Kelas teks pasangannya, mis. "text-ok-text"; huruf contoh dirender dengannya. */
  kelasTeks?: string;
  nama: string;
  nilai: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle",
          kelas,
          kelasTeks,
        )}
      >
        {kelasTeks ? "Aa" : null}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] leading-[14px] font-semibold">{nama}</p>
        <p className="font-mono text-[11px] leading-[14px] break-words text-muted-foreground">
          {nilai}
        </p>
      </div>
    </div>
  );
}

/** Spesimen: tampilan sesuatu tanpa perilakunya, plus kelas aslinya. */
export function Spesimen({
  kelas,
  isi,
  catatan,
}: {
  kelas: string;
  isi: ReactNode;
  catatan?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">{isi}</div>
      <code className="block overflow-x-auto rounded-xl bg-muted px-3 py-2 font-mono text-[11px] leading-[14px] whitespace-pre text-muted-foreground">
        {kelas}
      </code>
      {catatan ? (
        <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
          {catatan}
        </p>
      ) : null}
    </div>
  );
}
