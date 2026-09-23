import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Reveal } from "@/components/motion/reveal";
import { SubMenuAkun } from "@/components/profil/sub-menu-akun";
import { PilihTampilan } from "@/components/tampilan/pilih-tampilan";
import { TombolBawaan } from "@/components/tampilan/tombol-bawaan";
import { PesanAksi } from "@/components/shared/pesan-aksi";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Pengaturan Tampilan — K-Space V2",
  description: "Pilih menu dan widget mana yang tampil, dan dalam urutan apa.",
};

/**
 * Pengaturan Tampilan (PRD Personalisasi Fase 1).
 *
 * Tujuannya mengurangi kepadatan, bukan menambah pilihan: tiap peran
 * memakai sebagian kecil dari seluruh menu, dan sisanya cuma jarak
 * yang harus disisir sebelum sampai ke yang benar-benar dipakai.
 *
 * Daftar yang muncul di sini sudah disaring peran — menu berizin lewat
 * `izin`, widget Beranda lewat `widgetPerPeran`. Yang tidak boleh
 * dilihat tidak pernah masuk katalog, jadi tidak ada centang yang bisa
 * menambah hak akses. Penegakan di server menyusul pada Fase 3.
 */
export default async function PengaturanTampilanPage({
  searchParams,
}: PageProps<"/tampilan">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  return (
    <AppShell pengguna={pengguna} halaman="Pengaturan tampilan">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
                <SlidersHorizontal className="size-5 shrink-0 text-muted-foreground" />
                Pengaturan tampilan
              </h1>
              <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
                Pilih menu dan widget mana yang tampil untukmu. Yang kamu
                sembunyikan tetap bisa dibuka lewat tautan langsung — ini soal
                kepadatan layar, bukan hak akses.{" "}
                {modeData() === "demo"
                  ? "Lihat catatan di bawah soal tempat pilihanmu disimpan."
                  : "Pilihannya tersimpan di akunmu dan ikut ke perangkat lain."}
              </p>
            </div>

            <TombolBawaan />
          </div>

          <SubMenuAkun />
        </div>

        {modeData() === "demo" ? (
          <PesanAksi nada="netral" ukuran="sedang">
            Mode demo: pilihanmu disimpan di peramban ini saja, bukan di akunmu.
            Perangkat lain dan orang lain yang memakai komputer ini tidak ikut
            terbawa.
          </PesanAksi>
        ) : null}

        <Reveal>
          <PilihTampilan />
        </Reveal>
      </div>
    </AppShell>
  );
}
