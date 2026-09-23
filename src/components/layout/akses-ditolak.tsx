import Link from "next/link";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { hakPeran } from "@/lib/hak-akses";
import type { Pengguna } from "@/lib/types";

/**
 * Halaman yang ada, tapi bukan untuk peran ini.
 *
 * Sebelumnya jalur ini memanggil `notFound()`, dan orang yang salah
 * membuka tautan diberi tahu bahwa halamannya tidak ada — jawaban yang
 * keliru. Yang ia butuhkan: halaman ini nyata, hanya bukan haknya, dan
 * inilah cara memintanya.
 */
export function AksesDitolak({
  pengguna,
  halaman,
  siapa,
}: {
  pengguna: Pengguna;
  /** Judul halaman untuk AppShell dan kalimatnya. */
  halaman: string;
  /** Peran yang boleh membukanya, mis. "Finance, Manager, dan CEO". */
  siapa: string;
}) {
  // Diambil dari matriks yang sama dengan halaman peran, jadi daftar
  // ini tidak bisa menjanjikan sesuatu yang ternyata juga tertutup.
  const bisa = hakPeran(pengguna.role).map((h) => h.toLowerCase());

  return (
    <AppShell pengguna={pengguna} halaman={halaman}>
      <div className="mx-auto w-full max-w-lg space-y-4">
        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <div className="space-y-3 px-5 py-2 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warn-fill text-warn-text">
              <ShieldAlert className="size-6" />
            </span>
            <div>
              <h1 className="text-base leading-6 font-semibold">
                {halaman} bukan untuk peranmu
              </h1>
              <p className="mt-1 text-[13px] leading-[18px] text-pretty text-muted-foreground">
                Halaman ini hanya dibuka {siapa}. Kamu masuk sebagai{" "}
                {pengguna.role}. Kalau memang perlu aksesnya, mintalah kepada
                CEO atau Manager untuk mengubah peranmu.
              </p>

              {/* Yang dicari orang setelah membaca "bukan untukmu" bukan
                  penjelasan tambahan, melainkan dua hal: apa yang bisa
                  ia buka, dan kepada siapa memintanya. Keduanya ada di
                  halaman peran. */}
              {bisa.length > 0 ? (
                <p className="mt-2 text-[13px] leading-[18px] text-pretty text-muted-foreground">
                  Sebagai {pengguna.role} kamu tetap bisa {bisa.join(", ")}.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/beranda"
                className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
              >
                <ArrowLeft className="size-3.5" />
                Kembali ke Beranda
              </Link>
              <Link
                href="/tim/peran"
                className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
              >
                <ShieldCheck className="size-3.5" />
                Lihat peran &amp; hak akses
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
