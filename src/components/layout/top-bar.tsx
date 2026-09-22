import Link from "next/link";
import { FlaskConical, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NavigasiAtas } from "@/components/layout/navigasi-atas";
import { TombolKeluar } from "@/components/layout/tombol-keluar";
import { Lonceng } from "@/components/notifikasi/lonceng";
import { daftarNotifikasi, jumlahBelumDibacaSaya } from "@/lib/data/notifikasi";
import { kirimGagalPerNotifikasi } from "@/lib/data/kirim-wa";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { modeData } from "@/lib/supabase/config";
import type { Pengguna } from "@/lib/types";

/** App-bar atas: merek, pintasan, notifikasi, ringkasan profil. */
export async function TopBar({
  pengguna,
  halaman,
}: {
  pengguna: Pengguna;
  halaman: string;
}) {
  const demo = modeData() === "demo";
  const [notifikasi, belumDibaca, waGagal] = await Promise.all([
    daftarNotifikasi(pengguna),
    jumlahBelumDibacaSaya(pengguna),
    kirimGagalPerNotifikasi(pengguna),
  ]);
  const hariIni =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-canvas/90 backdrop-blur">
      <div className="flex items-center gap-4 px-4 py-3 lg:px-8 lg:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
            <span className="text-sm font-bold tracking-tight">K</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-base leading-6 font-bold tracking-tight">
              K-Space <span className="text-secondary">V2</span>
            </p>
            <p className="truncate text-[11px] leading-[14px] font-medium text-muted-foreground">
              {halaman}
            </p>
          </div>
        </div>

        <div className="hidden flex-1 justify-center lg:flex">
          <NavigasiAtas />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {demo ? (
            <span
              title="Supabase belum dikonfigurasi — angka di layar adalah data contoh, tidak tersimpan."
              className="hidden items-center gap-1.5 rounded-full bg-warn-fill px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-warn-text sm:inline-flex"
            >
              <FlaskConical className="size-3" />
              Mode demo
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Cari tiket, tugas, atau staf"
            className="tekan-halus hidden size-9 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground lg:flex"
          >
            <Search className="size-4" />
          </button>
          <Lonceng
            daftar={notifikasi}
            belumDibaca={belumDibaca}
            hariIni={hariIni}
            waGagal={waGagal}
          />

          <Link
            href="/profil"
            aria-label="Profil saya"
            className="tekan-halus sentuh-nyaman flex items-center gap-2 rounded-full bg-card py-1 pr-1 pl-3 ring-1 ring-border-subtle hover:bg-muted"
          >
            <div className="hidden text-right sm:block">
              <p className="text-xs leading-4 font-semibold">
                {pengguna.nama.split(" ")[0]}{" "}
                {pengguna.nama.split(" ")[1]?.[0]
                  ? `${pengguna.nama.split(" ")[1][0]}.`
                  : ""}
              </p>
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                {pengguna.role}
              </p>
            </div>
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">
                {pengguna.inisial}
              </AvatarFallback>
            </Avatar>
          </Link>

          {demo ? null : <TombolKeluar />}
        </div>
      </div>
    </header>
  );
}
