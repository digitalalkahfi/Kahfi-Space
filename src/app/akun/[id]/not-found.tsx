import Link from "next/link";
import { SearchX } from "lucide-react";

/**
 * 404 halaman Detail Akun (§5.1, E5). Sengaja tidak membedakan "akun
 * tidak ada" dari "akun di luar lingkupmu": pembedaan itu sendiri
 * membocorkan bahwa akun orang lain ada.
 */
export default function AkunTidakDitemukan() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-card px-5 py-8 text-center shadow-card ring-1 ring-border-subtle">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchX className="size-6" />
        </span>
        <div>
          <h1 className="text-base leading-6 font-semibold">
            Akun tidak ditemukan atau Anda tidak punya akses
          </h1>
          <p className="mt-1 text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Periksa kembali tautannya, atau buka akun dari Kelola Akun.
          </p>
        </div>
        <Link
          href="/grd/akun"
          className="tekan-halus sentuh-nyaman inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-[13px] leading-[18px] font-semibold text-primary-foreground"
        >
          Ke Kelola Akun
        </Link>
      </div>
    </main>
  );
}
