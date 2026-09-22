import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BellOff } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { KeadaanKosong } from "@/components/shared/keadaan";
import { DaftarNotifikasi } from "@/components/notifikasi/daftar-notifikasi";
import { TombolTandaiSemua } from "@/components/notifikasi/tombol-tandai";
import { SinkronNotifikasi } from "@/components/notifikasi/sinkron-notifikasi";
import { SubMenuNotifikasi } from "@/components/notifikasi/sub-menu-notifikasi";
import { daftarNotifikasi } from "@/lib/data/notifikasi";
import { kirimGagalPerNotifikasi } from "@/lib/data/kirim-wa";
import { jumlahBelumDibaca } from "@/lib/notifikasi";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Notifikasi — K-Space V2",
  description: "Peristiwa yang terjadi pada tugas, tenggat, dan pengajuanmu.",
};

/**
 * Pusat notifikasi in-app (PRD Fase 3).
 *
 * Satu tempat untuk peristiwa yang selama ini tersebar: tugas baru,
 * tenggat yang mendekat, keputusan izin, keputusan transaksi, dan
 * balasan masukan. Sebelumnya semuanya hanya bisa ditemukan dengan
 * membuka modulnya satu per satu dan mengingat apa yang berubah.
 */
export default async function NotifikasiPage({
  searchParams,
}: PageProps<"/notifikasi">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const hariIni =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const [daftar, waGagal] = await Promise.all([
    daftarNotifikasi(pengguna),
    kirimGagalPerNotifikasi(pengguna),
  ]);
  const belum = jumlahBelumDibaca(daftar);

  return (
    <AppShell pengguna={pengguna} halaman="Notifikasi">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Notifikasi
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              {belum > 0
                ? `${belum} belum dibaca dari ${daftar.length} notifikasi.`
                : `Semua sudah dibaca — ${daftar.length} notifikasi tercatat.`}
            </p>
          </div>

          <TombolTandaiSemua belumDibaca={belum} />
        </div>

        <SubMenuNotifikasi />

        <SinkronNotifikasi />

        {daftar.length === 0 ? (
          <KeadaanKosong
            ikon={<BellOff className="size-4" />}
            judul="Belum ada notifikasi untukmu"
            pesan="Notifikasi terbit sendiri saat ada tugas baru, tenggat mendekat, atau keputusan atas pengajuanmu. Tidak ada yang perlu kamu nyalakan."
          />
        ) : (
          <DaftarNotifikasi
            daftar={daftar}
            hariIni={hariIni}
            waGagal={waGagal}
          />
        )}
      </div>
    </AppShell>
  );
}
