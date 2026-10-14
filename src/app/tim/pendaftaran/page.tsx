import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AksesDitolak } from "@/components/layout/akses-ditolak";
import { DaftarPendaftaran } from "@/components/tim/daftar-pendaftaran";
import { cn } from "@/lib/utils";
import { bolehKelolaAnggota, daftarAnggotaTim } from "@/lib/data/anggota";
import {
  daftarPendaftaran,
  jumlahPendaftaranMenunggu,
  profilBisaDisambung,
} from "@/lib/data/pendaftaran";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Pendaftaran Anggota — K-Space V2",
  description: "Pendaftaran akun Google yang menunggu persetujuan CEO atau Manager.",
};

const TAB = [
  { kunci: "menunggu", label: "Menunggu persetujuan" },
  { kunci: "ditolak", label: "Ditolak" },
  { kunci: "disetujui", label: "Disetujui" },
] as const;

type KunciTab = (typeof TAB)[number]["kunci"];

/**
 * Persetujuan pendaftaran Google (docs/DAFTAR-GOOGLE-PERSETUJUAN.md §5).
 * Hanya CEO dan Manager (BR-01); peran lain melihat penjelasan, bukan
 * daftarnya — dan RLS 0209 tidak memberinya baris apa pun.
 */
export default async function PendaftaranPage({
  searchParams,
}: PageProps<"/tim/pendaftaran">) {
  const params = await searchParams;
  const pengguna = await sesiSaatIni(
    peranValid(params.persona) ? params.persona : undefined,
  );
  if (!pengguna) redirect("/masuk");

  if (!bolehKelolaAnggota(pengguna)) {
    return (
      <AksesDitolak
        pengguna={pengguna}
        halaman="Pendaftaran anggota"
        siapa="CEO dan Manager"
      />
    );
  }

  const tab: KunciTab = TAB.some((t) => t.kunci === params.tab)
    ? (params.tab as KunciTab)
    : "menunggu";

  const [daftar, menunggu, pilihan, semua, bisaDisambung] = await Promise.all([
    daftarPendaftaran(pengguna, tab),
    jumlahPendaftaranMenunggu(pengguna),
    pilihanOrganisasi(),
    daftarAnggotaTim(pengguna),
    tab === "disetujui" ? Promise.resolve([]) : profilBisaDisambung(pengguna),
  ]);

  return (
    <AppShell pengguna={pengguna} halaman="Anggota Tim">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="space-y-2">
          <Link
            href="/tim"
            className="tekan-halus inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Anggota tim
          </Link>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Pendaftaran anggota
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Orang yang masuk lewat Google dengan email yang belum dikenal
            menunggu di sini. Setujui sebagai anggota baru, sambungkan ke
            profil yang sudah ada, atau tolak dengan alasan.
          </p>
        </div>

        <nav aria-label="Status pendaftaran" className="flex flex-wrap gap-1">
          {TAB.map((t) => (
            <Link
              key={t.kunci}
              href={t.kunci === "menunggu" ? "/tim/pendaftaran" : `/tim/pendaftaran?tab=${t.kunci}`}
              aria-current={t.kunci === tab ? "page" : undefined}
              className={cn(
                "tekan-halus inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold",
                t.kunci === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground ring-1 ring-border-subtle hover:text-foreground",
              )}
            >
              {t.label}
              {t.kunci === "menunggu" && menunggu > 0 ? (
                <span className="rounded-full bg-danger px-1.5 text-[10px] leading-4 text-white">
                  {menunggu}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <DaftarPendaftaran
          daftar={daftar}
          status={tab}
          pilihan={pilihan}
          semua={semua}
          bisaDisambung={bisaDisambung}
        />
      </div>
    </AppShell>
  );
}
