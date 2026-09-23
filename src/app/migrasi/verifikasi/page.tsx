import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AksesDitolak } from "@/components/layout/akses-ditolak";
import { TabelVerifikasi } from "@/components/migrasi/tabel-verifikasi";
import {
  BelumDimigrasi,
  TabelBanding,
} from "@/components/migrasi/tabel-banding";
import { RingkasVerifikasi } from "@/components/migrasi/ringkas-verifikasi";
import { Reveal } from "@/components/motion/reveal";
import {
  barisKunciEkspor,
  bolehMigrasi,
  verifikasiJumlah,
} from "@/lib/data/migrasi";
import { bandingV1V2 } from "@/lib/data/banding";
import { jumlahTahap2 } from "@/lib/banding";
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
  if (!bolehMigrasi(pengguna)) {
    return (
      <AksesDitolak
        pengguna={pengguna}
        halaman="Verifikasi Migrasi"
        siapa="CEO dan Manager"
      />
    );
  }

  const [daftar, banding, kunciEkspor] = await Promise.all([
    verifikasiJumlah(typeof jalan === "string" ? jalan : undefined),
    bandingV1V2(),
    barisKunciEkspor(),
  ]);

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
            Verifikasi V1 vs V2
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Angka yang sama dihitung dari dua sisi: dari ekspor K-Space lama dan
            dari basis data V2. Migrasi baru boleh dianggap selesai kalau
            keduanya bertemu — bukan karena prosesnya berjalan tanpa pesan
            galat.
          </p>
        </div>

        <RingkasVerifikasi kelompok={banding} />

        {banding.map((k) => (
          <Reveal key={k.kunci}>
            <TabelBanding kelompok={k} />
          </Reveal>
        ))}

        <Reveal>
          <BelumDimigrasi jumlah={jumlahTahap2(kunciEkspor)} />
        </Reveal>

        <Reveal>
          <TabelVerifikasi daftar={daftar} />
        </Reveal>
      </div>
    </AppShell>
  );
}
