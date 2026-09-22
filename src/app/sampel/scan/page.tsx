import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LayarPindai } from "@/components/sampel/layar-pindai";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Pindai Sampel — K-Space V2",
  description: "Pindai kode QR sampel untuk melihat keadaan dan riwayatnya.",
};

export default async function ScanPage({
  searchParams,
}: PageProps<"/sampel/scan">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  return (
    <AppShell pengguna={pengguna} halaman="Sampel">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <Link
          href="/sampel"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Sampel
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Pindai sampel
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Yang kamu lihat hanya sampel yang memang boleh kamu lihat —
            memindai kode milik unit lain tidak akan menampilkan apa pun.
          </p>
        </div>

        <LayarPindai />
      </div>
    </AppShell>
  );
}
