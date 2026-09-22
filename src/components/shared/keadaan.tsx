import type { ReactNode } from "react";
import { Inbox, Loader2, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Empat keadaan yang dipunyai setiap modul: memuat, kosong, gagal, dan
 * (di berkas sebelah) konfirmasi.
 *
 * Dikumpulkan di satu tempat karena sebelumnya tiap halaman menuliskan
 * sendiri kalimat "belum ada data" dengan bentuk dan nada yang
 * berbeda-beda. Yang membingungkan bukan kalimatnya, melainkan
 * perbedaannya: orang jadi tidak yakin apakah kosong itu wajar atau
 * tanda sesuatu gagal.
 *
 * Prop `sisip` ada karena keadaan ini muncul di dua tempat: berdiri
 * sendiri menggantikan sebuah kartu, atau di dalam kartu yang sudah
 * punya judul sendiri. Yang kedua tidak boleh membawa kartu lagi —
 * dua garis tepi bertumpuk terbaca sebagai dua hal, padahal satu.
 */

/** Pembungkus bersama: kartu penuh, atau telanjang saat disisipkan. */
function Bungkus({
  sisip,
  className,
  children,
  ...sisa
}: {
  sisip: boolean;
  className?: string;
  children: ReactNode;
} & React.ComponentProps<"div">) {
  if (sisip) {
    return (
      <div className={className} {...sisa}>
        {children}
      </div>
    );
  }
  return (
    <Card
      className={cn("rounded-3xl shadow-card ring-border-subtle", className)}
      {...sisa}
    >
      {children}
    </Card>
  );
}

/** Kerangka isi selagi data dimuat; bentuknya mengikuti isi aslinya. */
export function KeadaanMemuat({
  label = "Memuat",
  baris = 3,
  sisip = false,
  className,
}: {
  label?: string;
  /** Berapa banyak kerangka baris yang ditampilkan. */
  baris?: number;
  /** Dipakai di dalam kartu yang sudah ada; kartu pembungkusnya dilepas. */
  sisip?: boolean;
  className?: string;
}) {
  return (
    <Bungkus
      sisip={sisip}
      role="status"
      aria-label={label}
      className={className}
    >
      <div className={cn("space-y-2", !sisip && "px-5")}>
        <div className="flex items-center gap-2 text-[11px] leading-[14px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {label}…
        </div>
        {Array.from({ length: baris }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </Bungkus>
  );
}

/**
 * Keadaan kosong.
 *
 * Selalu menyebutkan apa yang membuatnya kosong dan apa langkah
 * berikutnya — "belum ada data" saja membuat orang menebak apakah ia
 * salah menyaring atau memang belum ada isinya.
 *
 * Konvensi kalimat yang sudah berlaku di seluruh aplikasi dipertahankan:
 * "Belum ada X" untuk yang memang belum pernah ada, "Tidak ada X yang
 * cocok dengan saringan ini" untuk yang tersaring habis.
 */
export function KeadaanKosong({
  judul,
  pesan,
  aksi,
  ikon,
  sisip = false,
  className,
}: {
  judul: string;
  pesan: string;
  /** Tombol atau tautan langkah berikutnya; boleh kosong. */
  aksi?: ReactNode;
  ikon?: ReactNode;
  /** Dipakai di dalam kartu yang sudah ada; kartu pembungkusnya dilepas. */
  sisip?: boolean;
  className?: string;
}) {
  return (
    <Bungkus sisip={sisip} className={className}>
      <div
        className={cn(
          "flex flex-col items-center gap-2 py-2 text-center",
          !sisip && "px-5",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          {ikon ?? <Inbox className="size-4" />}
        </span>
        <h3 className="text-[13px] leading-[18px] font-semibold">{judul}</h3>
        <p className="max-w-prose text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {pesan}
        </p>
        {aksi}
      </div>
    </Bungkus>
  );
}

/**
 * Keadaan gagal.
 *
 * Menawarkan tindakan, bukan permintaan maaf. Pesan galat mentah tidak
 * ditampilkan — ia menyebut nama tabel dan kolom, dan itu bukan untuk
 * semua mata; yang berguna bagi pelapor adalah kode galatnya.
 */
export function KeadaanGagal({
  judul = "Gagal dimuat",
  pesan,
  aksi,
  kode,
  sisip = false,
  className,
}: {
  judul?: string;
  pesan: string;
  aksi?: ReactNode;
  kode?: string;
  /** Dipakai di dalam kartu yang sudah ada; kartu pembungkusnya dilepas. */
  sisip?: boolean;
  className?: string;
}) {
  return (
    <Bungkus sisip={sisip} className={className}>
      <div className={cn("space-y-2", !sisip && "px-5")}>
        <h3 className="flex items-center gap-2 text-[13px] leading-[18px] font-semibold text-danger-text">
          <TriangleAlert className="size-4 shrink-0" />
          {judul}
        </h3>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {pesan}
        </p>
        {aksi}
        {kode ? (
          <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
            Kode galat: {kode}
          </p>
        ) : null}
      </div>
    </Bungkus>
  );
}
