import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { TabelProgres } from "@/components/lms/tabel-progres";
import { Reveal } from "@/components/motion/reveal";
import { SaringProgres } from "@/components/lms/saring-progres";
import { progresBelajarTim } from "@/lib/data/lms";
import { bacaSaringanProgres, saringProgres } from "@/lib/lms";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Progres Belajar — K-Space V2",
  description:
    "Kemajuan pelatihan wajib tiap anggota tim dalam cakupan yang kamu pimpin.",
};

export default async function ProgresBelajarPage({
  searchParams,
}: PageProps<"/lms/progres">) {
  const params = await searchParams;
  const { persona } = params;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const semua = await progresBelajarTim(pengguna);
  const saringan = bacaSaringanProgres(params);
  const daftar = saringProgres(semua, saringan);

  // Pilihan unit dari daftar penuh, supaya menyaring satu unit tidak
  // membuat unit lain lenyap dari pilihannya.
  const unit = [...new Set(semua.map((p) => p.unitNama))].sort();

  return (
    <AppShell pengguna={pengguna} halaman="Pembelajaran">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/lms"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Pembelajaran
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Progres belajar
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Hanya orang dalam cakupanmu yang muncul di sini. Yang paling
            tertinggal ditampilkan lebih dulu.
          </p>
        </div>

        <Reveal>
          <SaringProgres
            saringan={saringan}
            unit={unit}
            jumlah={daftar.length}
            total={semua.length}
          />

          <TabelProgres daftar={daftar} ringkasDari={semua} />
        </Reveal>
      </div>
    </AppShell>
  );
}
