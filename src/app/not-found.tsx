import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * Halaman 404 berbahasa Indonesia.
 *
 * Tanpa berkas ini Next menampilkan halaman bawaannya yang berbahasa
 * Inggris — satu-satunya layar berbahasa asing di seluruh aplikasi, dan
 * justru muncul saat orang sedang tersesat.
 */
export default function TidakDitemukan() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-card px-5 py-8 text-center shadow-card ring-1 ring-border-subtle">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Compass className="size-6" />
        </span>
        <div>
          <h1 className="text-base leading-6 font-semibold">
            Halaman tidak ditemukan
          </h1>
          <p className="mt-1 text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Alamatnya mungkin salah ketik, atau isinya sudah dipindahkan.
          </p>
        </div>
        <Link
          href="/beranda"
          className="tekan-halus sentuh-nyaman inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-[13px] leading-[18px] font-semibold text-primary-foreground"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}
