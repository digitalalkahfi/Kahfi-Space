import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { TabelVerifikasi } from "@/components/migrasi/tabel-verifikasi";
import { Reveal } from "@/components/motion/reveal";
import { bolehMigrasi, verifikasiJumlah } from "@/lib/data/migrasi";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Verifikasi Migrasi — K-Space V2",
  description:
    "Perbandingan jumlah baris antara kv_store dan tabel tujuan setelah migrasi.",
};

export default async function VerifikasiPage({
  searchParams,
}: PageProps<"/migrasi/verifikasi">) {
  const { persona, jalan } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");
  if (!bolehMigrasi(pengguna)) notFound();

  const daftar = await verifikasiJumlah(
    typeof jalan === "string" ? jalan : undefined,
  );

  return (
    <AppShell pengguna={pengguna} halaman="Migrasi Data">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/migrasi"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Migrasi
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Verifikasi jumlah baris
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Migrasi baru boleh dianggap selesai kalau angkanya bisa
            dipertanggungjawabkan — bukan karena prosesnya berjalan tanpa
            pesan galat.
          </p>
        </div>

        <Reveal>
          <TabelVerifikasi daftar={daftar} />
        </Reveal>
      </div>
    </AppShell>
  );
}
