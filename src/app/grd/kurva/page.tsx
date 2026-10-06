import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { TabelKurva } from "@/components/grd/tabel-kurva";
import { Reveal } from "@/components/motion/reveal";
import { kurvaGrd } from "@/lib/data/kurva";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";
import { bulanPanjang, hariIniWib } from "@/lib/format";
import { gayaKeputusanWrm } from "@/lib/unit";
import { ARTI_WRM } from "@/lib/wrm";
import { cn } from "@/lib/utils";
import { tanggalDataTerakhir } from "@/lib/laporan";
import type { KeputusanWrm } from "@/lib/types";

export const metadata: Metadata = {
  title: "Kurva WRM — K-Space V2",
  description:
    "Target kumulatif GRD tiap Sabtu, aktualnya, dan status HIJAU/MERAH.",
};

/** Matriks keputusan WRM sesuai DECISION-021 file GRD. */
const MATRIKS: { hasil: string; kegiatan: string; keputusan: KeputusanWrm }[] =
  [
    { hasil: "HIJAU", kegiatan: "HIJAU", keputusan: "LANJUT" },
    { hasil: "HIJAU", kegiatan: "MERAH", keputusan: "ALARM" },
    { hasil: "MERAH", kegiatan: "HIJAU", keputusan: "SABAR" },
    { hasil: "MERAH", kegiatan: "MERAH", keputusan: "UBAH CARA" },
  ];

export default async function KurvaPage({
  searchParams,
}: PageProps<"/grd/kurva">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const tanggal = modeData() === "demo" ? TANGGAL_ACUAN : hariIniWib();
  const periode = `${tanggal.slice(0, 7)}-01`;
  // Aktual dibaca sampai kemarin: GMV dilaporkan keesokan harinya (H-1).
  const daftar = await kurvaGrd(pengguna, periode, tanggalDataTerakhir(tanggal));

  return (
    <AppShell pengguna={pengguna} halaman="GRD">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Link
          href="/grd"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          GRD
        </Link>

        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Kurva WRM
          </h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {bulanPanjang(periode)} · target yang harus sudah tercapai setiap
            Sabtu, dibahas di WRM.
          </p>
        </div>

        <Reveal>
          <TabelKurva daftar={daftar} acuan={tanggal} />
        </Reveal>

        <Reveal>
          <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
            <div className="px-5">
              <h2 className="text-base leading-6 font-semibold">
                Matriks keputusan WRM
              </h2>
              <p className="text-[13px] leading-[18px] text-muted-foreground">
                DECISION-021. Hasil merah dua pekan berturut-turut = UBAH CARA.
                Gagal → ubah cara, bukan ganti target.
              </p>
            </div>
            <ul className="grid gap-2 px-5 sm:grid-cols-2">
              {MATRIKS.map((m) => {
                const gaya = gayaKeputusanWrm[m.keputusan];
                return (
                  <li
                    key={m.keputusan}
                    className="space-y-1 rounded-2xl bg-muted/50 p-3"
                  >
                    <p className="flex flex-wrap items-center gap-1.5 text-[11px] leading-[14px] text-muted-foreground">
                      Hasil {m.hasil} + kegiatan {m.kegiatan}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] leading-[13px] font-bold",
                          gaya.kelas,
                        )}
                      >
                        {m.keputusan}
                      </span>
                    </p>
                    <p className="text-[13px] leading-[18px]">
                      {ARTI_WRM[m.keputusan]}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Reveal>
      </div>
    </AppShell>
  );
}
