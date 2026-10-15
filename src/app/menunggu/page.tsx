import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Ban, UserX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TombolKeluar } from "@/components/layout/tombol-keluar";
import { IsiMenunggu } from "@/components/pendaftaran/isi-menunggu";
import { keadaanAkunSaya } from "@/lib/data/pendaftaran";

export const metadata: Metadata = {
  title: "Menunggu persetujuan — K-Space V2",
  description: "Pendaftaran akun K-Space menunggu persetujuan Manager atau CEO.",
};

/**
 * Layar untuk akun yang sudah login tetapi belum/tidak boleh memakai
 * K-Space (middleware mengarahkan ke sini, lihat `alihkanMenurutStatus`):
 *
 *   menunggu     — pendaftar Google: isi No. WA, lalu menunggu
 *   ditolak      — alasan penolakan (BR-09: tidak bisa mengajukan ulang)
 *   nonaktif     — profil dinonaktifkan (E6)
 *   tanpa_profil — akun login tanpa profil maupun pendaftaran
 *
 * Tidak memakai AppShell: kerangka itu butuh profil aktif.
 */
export default async function MenungguPage() {
  const akun = await keadaanAkunSaya();
  if (!akun) redirect("/masuk");
  if (akun.status === "aktif") redirect("/beranda");

  const p = akun.pendaftaran;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div className="space-y-1.5 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <span className="text-lg font-bold tracking-tight">K</span>
          </span>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight">
            {akun.status === "menunggu"
              ? "Lengkapi pendaftaran"
              : akun.status === "ditolak"
                ? "Pendaftaran ditolak"
                : "Akun belum bisa dipakai"}
          </h1>
          <p className="text-[13px] leading-[18px] break-all text-muted-foreground">
            Masuk sebagai {akun.email}
          </p>
        </div>

        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <div className="space-y-3 px-5">
            {akun.status === "menunggu" && p ? (
              <IsiMenunggu
                noWa={p.noWa}
                unitDiajukan={p.unitDiajukan}
                catatan={p.catatan}
              />
            ) : akun.status === "ditolak" && p ? (
              <Pesan ikon={<Ban className="size-5" />}>
                Pendaftaran ditolak: {p.alasanTolak}. Hubungi Manager.
              </Pesan>
            ) : akun.status === "nonaktif" ? (
              <Pesan ikon={<UserX className="size-5" />}>
                Akun tidak aktif, hubungi Manager.
              </Pesan>
            ) : (
              <Pesan ikon={<UserX className="size-5" />}>
                Akun ini belum terdaftar sebagai anggota K-Space. Hubungi
                Manager.
              </Pesan>
            )}
          </div>
        </Card>

        <div className="flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
          <TombolKeluar />
          <span>Keluar dan masuk dengan akun lain</span>
        </div>
      </div>
    </main>
  );
}

function Pesan({
  ikon,
  children,
}: {
  ikon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-danger-fill p-3 text-danger-text">
      <span className="mt-0.5 shrink-0">{ikon}</span>
      <p className="text-[13px] leading-[18px] text-pretty">{children}</p>
    </div>
  );
}
