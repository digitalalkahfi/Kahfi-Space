"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { pintasanAtas } from "@/lib/navigasi";
import { useSusunan } from "@/components/tampilan/penyedia-tampilan";

/**
 * Empat pintasan di app-bar atas (PRD §2).
 *
 * Sebelumnya di tempat ini ada saklar "Hari Ini / Minggu Ini / Bulan Ini /
 * Laporan" yang hanya menyimpan pilihan di state lokal: ditekan, warnanya
 * pindah, dan tidak terjadi apa-apa. Filter periode sudah pindah ke dalam
 * modul yang benar-benar memakainya (Finance, GRD, absensi), jadi ruang
 * ini dipakai untuk yang memang butuh dijangkau cepat dari mana saja.
 *
 * Keempatnya justru DIKELUARKAN dari rail kiri (lihat `pintuLainDiDesktop` di
 * lib/navigasi.ts): dua tombol menuju halaman yang sama membuat orang
 * mengira keduanya berbeda. Laporan Harian tidak ada di sini karena ia
 * salah satu dari lima menu utama dan sudah punya tempat tetap di rail.
 *
 * App-bar atas ini desktop saja; di mobile pintu masuknya tetap laci
 * "Lainnya" pada bottom-nav.
 */
export function NavigasiAtas({ className }: { className?: string }) {
  const pathname = usePathname();
  const terpilih = useSusunan("pintasan")(pintasanAtas);

  // Bar kosong bukan bar tanpa isi: ia kapsul abu-abu selebar beberapa
  // piksel yang tidak menjelaskan apa pun. Lebih baik tidak ada.
  if (terpilih.length === 0) return null;

  return (
    <nav
      aria-label="Pintasan"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-card p-1 ring-1 ring-border-subtle",
        className,
      )}
    >
      {terpilih.map((item) => {
        // Cocokkan sebagai segmen utuh: "/sampel/scan" tidak boleh ikut
        // menyala saat yang dibuka "/sampel/scan-lama" seandainya ada.
        const aktif =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "tekan-halus sentuh-nyaman rounded-full px-4 py-2 text-xs leading-4 font-semibold whitespace-nowrap",
              aktif
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
