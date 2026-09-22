import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import {
  BelumAdaMigrasi,
  DaftarBermasalah,
  RingkasJalan,
  TabelEntitas,
} from "@/components/migrasi/status-migrasi";
import { Reveal } from "@/components/motion/reveal";
import { PanelEkspor } from "@/components/migrasi/panel-ekspor";
import { PanelJalankan } from "@/components/migrasi/panel-jalankan";
import { PanelKspaceLama } from "@/components/migrasi/panel-kspace-lama";
import {
  bolehMigrasi,
  catatanBermasalah,
  eksporKvStore,
  persetujuanPemetaan,
  ringkasMigrasi,
  riwayatMigrasi,
  riwayatKspaceLama,
  statusKspaceLama,
} from "@/lib/data/migrasi";
import { PEMETAAN, versiPemetaan } from "@/lib/pemetaan";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";
import { tanggalPanjang } from "@/lib/format";

export const metadata: Metadata = {
  title: "Migrasi Data Lama — K-Space V2",
  description:
    "Status pemindahan data dari kv_store: apa yang sudah pindah, apa yang belum, dan apa yang gagal.",
};

export default async function MigrasiPage({
  searchParams,
}: PageProps<"/migrasi">) {
  const { persona, jalan } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  // Migrasi memuat data pribadi seluruh karyawan; bukan halaman umum.
  if (!bolehMigrasi(pengguna)) notFound();

  const [riwayat, ekspor, persetujuan, lama, riwayatLama] = await Promise.all([
    riwayatMigrasi(),
    eksporKvStore(),
    persetujuanPemetaan(),
    statusKspaceLama(),
    riwayatKspaceLama(),
  ]);

  // Migrasi sungguhan menunggu seluruh pemetaan disetujui pada versinya
  // yang sekarang — persetujuan lama tidak terbawa ke pemetaan yang sudah
  // disunting.
  const belumDisetujui = PEMETAAN.filter(
    (p) =>
      !persetujuan.some(
        (s) => s.entitas === p.kunci && s.versi === versiPemetaan(p),
      ),
  );
  const terpilih =
    (typeof jalan === "string"
      ? riwayat.find((j) => j.id === jalan)
      : undefined) ?? riwayat[0];

  const [ringkas, bermasalah] = await Promise.all([
    terpilih ? ringkasMigrasi(terpilih.id) : Promise.resolve([]),
    terpilih ? catatanBermasalah(terpilih.id) : Promise.resolve([]),
  ]);

  return (
    <AppShell pengguna={pengguna} halaman="Migrasi Data">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Migrasi data lama
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Pemindahan dari <span className="font-mono">kv_store</span> sistem
            lama. Setiap entri dicatat beserta alasannya, supaya kegagalan
            tidak baru ketahuan berbulan-bulan kemudian.
          </p>
        </div>

        <PanelKspaceLama status={lama} riwayat={riwayatLama} />

        <PanelJalankan
          siapSungguhan={belumDisetujui.length === 0}
          alasanBelumSiap={
            modeData() === "demo"
              ? "Mode demo tidak terhubung ke sistem lama, jadi tidak ada yang bisa ditulis."
              : `Menunggu persetujuan pemetaan: ${belumDisetujui
                  .map((p) => p.label)
                  .join(", ")}.`
          }
        />

        <Link
          href="/migrasi/verifikasi"
          className="baris-interaktif flex items-center gap-3 rounded-3xl bg-card px-5 py-4 shadow-card ring-1 ring-border-subtle"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-[18px] font-semibold">
              Verifikasi jumlah baris
            </span>
            <span className="block text-[11px] leading-[14px] text-pretty text-muted-foreground">
              Apakah yang tercatat berhasil benar-benar ada di tabel tujuan.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>

        <Link
          href="/migrasi/pemetaan"
          className="baris-interaktif flex items-center gap-3 rounded-3xl bg-card px-5 py-4 shadow-card ring-1 ring-border-subtle"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-[18px] font-semibold">
              Pemetaan entitas &amp; persetujuan
            </span>
            <span className="block text-[11px] leading-[14px] text-pretty text-muted-foreground">
              Medan lama mana menjadi kolom apa, dan siapa yang sudah
              meninjaunya.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>

        {terpilih ? (
          <>
            <Reveal>
              <RingkasJalan
                jalan={terpilih}
                ringkas={ringkas}
                bolehTutup
              />
            </Reveal>

            <Reveal>
              <TabelEntitas ringkas={ringkas} />
            </Reveal>

            {bermasalah.length > 0 ? (
              <Reveal>
                <DaftarBermasalah daftar={bermasalah} />
              </Reveal>
            ) : null}
          </>
        ) : (
          <>
            <BelumAdaMigrasi demo={modeData() === "demo"} />

            <Reveal>
              <TabelEntitas ringkas={[]} />
            </Reveal>

            <Reveal>
              <PanelEkspor
                sumber={ekspor.sumber}
                dibuatPada={tanggalPanjang(ekspor.dibuatPada)}
                jumlah={ekspor.jumlah}
                tiruan={ekspor.tiruan}
                ringkas={ekspor.ringkas}
                masalah={ekspor.masalah}
                contohJson={JSON.stringify(
                  { entri: ekspor.entri.slice(0, 6) },
                  null,
                  2,
                )}
              />
            </Reveal>
          </>
        )}
      </div>
    </AppShell>
  );
}
