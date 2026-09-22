import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LogAset } from "@/components/aset/log-aset";
import { SaringLogAset } from "@/components/aset/saring-log-aset";
import { UnduhLogAset } from "@/components/aset/unduh-log-aset";
import { Reveal } from "@/components/motion/reveal";
import { bacaSaringanLogAset, saringLogAset } from "@/lib/aset";
import { logPerubahanAset } from "@/lib/data/aset";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Log Perubahan Aset — K-Space V2",
  description:
    "Setiap perpindahan pemegang dan perubahan keadaan aset, beserta pencatatnya.",
};

export default async function LogAsetPage({
  searchParams,
}: PageProps<"/aset/riwayat">) {
  const params = await searchParams;
  const pengguna = await sesiSaatIni(
    peranValid(params.persona) ? params.persona : undefined,
  );
  if (!pengguna) redirect("/masuk");

  const semua = await logPerubahanAset(pengguna);
  const saringan = bacaSaringanLogAset(params);
  const tersaring = saringLogAset(semua, saringan);
  const unit = [...new Set(semua.map((k) => k.unitNama))].sort();

  return (
    <AppShell pengguna={pengguna} halaman="Aset">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/aset"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Aset
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Log perubahan aset
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Setiap perpindahan pemegang dan perubahan keadaan, terbaru dulu.
            Tidak pernah disunting — koreksi dicatat sebagai kejadian baru.
          </p>
        </div>

        <SaringLogAset
          saringan={saringan}
          unit={unit}
          jumlah={tersaring.length}
          total={semua.length}
        />

        <UnduhLogAset daftar={tersaring} />

        <Reveal>
          <LogAset daftar={tersaring} />
        </Reveal>
      </div>
    </AppShell>
  );
}
