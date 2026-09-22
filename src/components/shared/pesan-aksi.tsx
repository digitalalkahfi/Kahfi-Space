import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Hasil } from "@/lib/data/hasil";

/**
 * Kabar hasil sebuah aksi — berhasil, gagal, atau sekadar keterangan.
 *
 * Dikumpulkan jadi satu karena audit UX menemukan 59 titik seperti ini
 * tersebar di 56 berkas dengan 16 bentuk kelas yang berbeda, dan yang
 * paling merepotkan bukan bentuknya melainkan warnanya: gagal kadang
 * kuning, kadang merah, kadang abu-abu. Orang tidak bisa belajar arti
 * sebuah warna kalau artinya berubah-ubah.
 *
 * Tiga nada, dan hanya tiga:
 * - `berhasil` hijau — sesuatu benar-benar tersimpan;
 * - `gagal` kuning — tidak tersimpan, dan kalimatnya menjelaskan kenapa;
 * - `netral` abu-abu — keterangan keadaan, bukan hasil sebuah percobaan.
 *
 * Selalu `role="status"`: pembaca layar mengumumkannya tanpa merebut
 * fokus dari tempat orang sedang mengetik.
 */
export type NadaPesan = "berhasil" | "gagal" | "netral";

const GAYA: Record<NadaPesan, string> = {
  berhasil: "bg-ok-fill text-ok-text",
  gagal: "bg-warn-fill text-warn-text",
  netral: "bg-muted text-muted-foreground",
};

export function PesanAksi({
  nada,
  children,
  ukuran = "kecil",
  className,
}: {
  nada: NadaPesan;
  children: ReactNode;
  /** `kecil` di dalam kartu/dialog, `sedang` saat berdiri sendiri. */
  ukuran?: "kecil" | "sedang";
  className?: string;
}) {
  return (
    <p
      role="status"
      className={cn(
        "rounded-xl text-pretty",
        ukuran === "kecil"
          ? "px-3 py-2 text-[11px] leading-[14px]"
          : "px-4 py-2.5 text-[13px] leading-[18px]",
        GAYA[nada],
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Nada yang tepat untuk sebuah `Hasil`.
 *
 * Mode demo bukan kegagalan orangnya — aplikasinya memang belum
 * terhubung — jadi ia netral, bukan kuning.
 */
export function nadaHasil(hasil: Hasil<unknown>): NadaPesan {
  if (hasil.ok) return "berhasil";
  return hasil.kode === "demo" ? "netral" : "gagal";
}
