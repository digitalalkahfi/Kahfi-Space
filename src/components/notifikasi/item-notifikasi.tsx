import Link from "next/link";
import {
  Bell,
  CalendarClock,
  CircleAlert,
  ClipboardList,
  Megaphone,
  MessageCircleOff,
  MessageSquare,
  UserCheck,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TombolTandaiSatu } from "@/components/notifikasi/tombol-tandai";
import { jamWib, tanggalRelatif } from "@/lib/format";
import {
  GAYA_KATEGORI,
  LABEL_KATEGORI,
  type KategoriNotifikasi,
  type Notifikasi,
} from "@/lib/notifikasi";

const IKON: Record<KategoriNotifikasi, typeof Bell> = {
  tugas: ClipboardList,
  tenggat: CalendarClock,
  pengumuman: Megaphone,
  izin: UserCheck,
  transaksi: Wallet,
  anggaran: Wallet,
  masukan: MessageSquare,
};

/**
 * Satu notifikasi.
 *
 * Berdiri sendiri sebagai komponen karena dipakai dua tempat: halaman
 * /notifikasi dan laci lonceng di app-bar. Dua salinan bentuk yang sama
 * adalah cara paling mudah membuat notifikasi yang sudah dibaca
 * terlihat berbeda di dua tempat.
 *
 * Seluruh barisnya adalah tautan, bukan hanya judulnya: target sentuh
 * selebar kartu jauh lebih mudah dikenai di ponsel, dan tidak ada
 * bagian kartu ini yang menuju tempat lain.
 *
 * Tautannya dipercaya karena lapisan data sudah menyaringnya lewat
 * `tautanAman()` — kolom yang berakhir di href tidak boleh menerima
 * apa pun dari luar aplikasi.
 */
export function ItemNotifikasi({
  n,
  hariIni,
  ringkas = false,
  bisaTandai = false,
  waGagal = false,
}: {
  n: Notifikasi;
  hariIni: string;
  /** Bentuk pendek untuk laci lonceng: tanpa baris pesan. */
  ringkas?: boolean;
  /** Tampilkan tombol tandai-dibaca; hanya di halaman notifikasi. */
  bisaTandai?: boolean;
  /**
   * Pesan WhatsApp-nya gagal terkirim.
   *
   * Ditandai supaya orangnya tahu kabar ini TIDAK sampai ke ponselnya —
   * itulah gunanya cadangan in-app. Tanpa penanda, ia akan mengira
   * memang tidak ada yang dikirim.
   */
  waGagal?: boolean;
}) {
  const Ikon = IKON[n.kategori] ?? CircleAlert;
  const gaya = GAYA_KATEGORI[n.kategori];
  const belum = n.dibacaPada === null;

  return (
    <Link
      href={n.tautan}
      className={cn(
        "baris-interaktif flex items-start gap-3 rounded-2xl p-3 hover:bg-muted/50",
        belum && "bg-muted/40",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          gaya.latar,
          gaya.teks,
        )}
      >
        <Ikon className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={cn(
              "text-[13px] leading-[18px] text-pretty",
              belum ? "font-semibold" : "font-medium",
            )}
          >
            {n.judul}
          </span>
          {belum ? (
            <span
              aria-label="Belum dibaca"
              className="size-1.5 shrink-0 rounded-full bg-secondary"
            />
          ) : null}
        </span>

        {ringkas ? null : (
          <span className="block text-[11px] leading-[14px] text-pretty text-muted-foreground">
            {n.pesan}
          </span>
        )}

        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-[14px] text-muted-foreground">
          <span className="font-semibold">{LABEL_KATEGORI[n.kategori]}</span>
          <span aria-hidden>·</span>
          <span>
            {tanggalRelatif(n.dibuatPada, hariIni)} {jamWib(n.dibuatPada)}
          </span>
          {waGagal ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warn-fill px-2 py-0.5 font-semibold text-warn-text">
              <MessageCircleOff className="size-3" />
              WhatsApp gagal
            </span>
          ) : null}
        </span>
      </span>

      {bisaTandai && belum ? <TombolTandaiSatu id={n.id} /> : null}
    </Link>
  );
}
