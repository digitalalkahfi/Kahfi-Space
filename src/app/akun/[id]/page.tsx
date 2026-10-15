import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { PilihRentangPeriode } from "@/components/shared/pilih-rentang-periode";
import { KartuRingkasAkun } from "@/components/akun/kartu-ringkas-akun";
import { GrafikAkun, type DeretMetrik } from "@/components/akun/grafik-akun";
import {
  akunTerbuka,
  bolehLihatKomisiAkun,
  hariAkun,
} from "@/lib/data/detail-akun";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import {
  dalamRentang,
  rentangGrafik,
  ringkasAkun,
  sejajarkan,
  titikMetrik,
  type MetrikGrafik,
} from "@/lib/detail-akun";
import { bacaRentangGmv, rentangPembanding } from "@/lib/gmv";
import { tanggalDataTerakhir } from "@/lib/laporan";
import { hariIniWib } from "@/lib/format";
import { modeData } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Detail Akun — K-Space V2",
  description: "Angka dan grafik satu akun per periode.",
};

/** Halaman asal yang dikenal, untuk tombol kembali (§5.2 no. 1). */
const ASAL = {
  gmv: { href: "/gmv/affiliator", label: "Detail akun Affiliator" },
  akun: { href: "/grd/akun", label: "Kelola Akun" },
} as const;

/**
 * Detail satu akun dengan grafik (docs/DETAIL-PER-AKUN-GRAFIK.md §5).
 *
 * Penjaganya RLS: akunnya dibaca lewat klien biasa, jadi yang tidak
 * terbaca oleh pengguna ini menjadi 404 (§5.1, AC7). Komisi hanya
 * dimuat — dan hanya dirender — bila `boleh_lihat_komisi(akun)`.
 */
export default async function DetailAkunPage({
  params,
  searchParams,
}: PageProps<"/akun/[id]">) {
  const [{ id }, cari] = await Promise.all([params, searchParams]);
  const pengguna = await sesiSaatIni(
    peranValid(cari.persona) ? cari.persona : undefined,
  );
  if (!pengguna) redirect("/masuk");

  const hariIni = tanggalDataTerakhir(
    modeData() === "demo" ? TANGGAL_ACUAN : hariIniWib(),
  );
  const rentang = bacaRentangGmv(cari, hariIni);
  const pembanding = rentangPembanding(rentang, hariIni);

  const akun = await akunTerbuka(pengguna, id, rentang.dari, rentang.sampai);
  if (!akun) notFound();

  const lihatKomisi = await bolehLihatKomisiAkun(pengguna, akun);
  const grafik = rentangGrafik(rentang, pembanding.penuh);

  // Satu tarikan untuk seluruh hari yang dibutuhkan halaman: periode
  // ini, pembandingnya, dan jendela grafik beserta pembandingnya.
  const awal = [
    rentang.dari,
    pembanding.dari,
    grafik.sekarang.dari,
    grafik.lalu.dari,
  ].sort()[0];
  const akhir = [rentang.sampai, grafik.sekarang.sampai]
    .sort()
    .at(-1) as string;
  const hari = await hariAkun(akun, awal, akhir, hariIni, lihatKomisi);

  const kini = ringkasAkun(dalamRentang(hari, rentang));
  const lalu = ringkasAkun(dalamRentang(hari, pembanding));

  const deret = (metrik: MetrikGrafik): DeretMetrik => {
    const sekarang = titikMetrik(
      dalamRentang(hari, grafik.sekarang),
      metrik,
      grafik.granularitas,
    );
    return {
      sekarang,
      lalu: sejajarkan(
        sekarang,
        titikMetrik(
          dalamRentang(hari, grafik.lalu),
          metrik,
          grafik.granularitas,
        ),
      ),
    };
  };

  const asal =
    cari.asal === "gmv" || cari.asal === "akun" ? ASAL[cari.asal] : null;
  const kueriAsal = new URLSearchParams();
  for (const k of ["periode", "acuan", "dari", "sampai", "persona"]) {
    const v = cari[k];
    if (typeof v === "string") kueriAsal.set(k, v);
  }
  const tujuanKembali = asal ?? ASAL.akun;
  const hrefKembali =
    tujuanKembali === ASAL.gmv && kueriAsal.size > 0
      ? `${tujuanKembali.href}?${kueriAsal}`
      : tujuanKembali.href;

  return (
    <AppShell pengguna={pengguna} halaman="Detail akun">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Link
          href={hrefKembali}
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          {tujuanKembali.label}
        </Link>

        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <div className="space-y-2 px-5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] leading-7 font-bold tracking-tight break-all lg:text-[28px] lg:leading-9">
                {akun.username}
              </h1>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  akun.status === "aktif"
                    ? "bg-ok-fill text-ok-text"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {akun.status === "aktif" ? "Aktif" : "Nonaktif"}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] leading-4 sm:grid-cols-4">
              {[
                ["Unit", akun.unitNama.split(" (")[0]],
                ["PIC", akun.picNama ?? "Belum ada"],
                ["Level", akun.level === null ? "—" : String(akun.level)],
                [
                  "Minimum upload",
                  akun.minimum === null ? "—" : `${akun.minimum} / hari kerja`,
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        <PilihRentangPeriode rentang={rentang} hariIni={hariIni} />

        <Reveal>
          <KartuRingkasAkun
            sekarang={{ gmv: kini.gmv, upload: kini.upload }}
            sebelumnya={{ gmv: lalu.gmv, upload: lalu.upload }}
            komisi={
              lihatKomisi
                ? { sekarang: kini.komisi, sebelumnya: lalu.komisi }
                : null
            }
            kepatuhan={akun.kepatuhan.rasio}
            hariLapor={kini.hariLapor}
            // Sama dengan kolom "Lapor / kerja" tabel per akun: hari kerja
            // dari penilaian kepatuhan bila akun punya level.
            hariKerja={
              akun.minimum !== null ? akun.kepatuhan.hariKerja : kini.hariKerja
            }
            pembanding={
              pembanding.dipotong
                ? `${pembanding.penuh.label} (sepadan)`
                : pembanding.penuh.label
            }
          />
        </Reveal>

        <Reveal>
          <GrafikAkun
            deret={{
              gmv: deret("gmv"),
              ...(lihatKomisi ? { komisi: deret("komisi") } : {}),
              upload: deret("upload"),
            }}
            minimum={akun.minimum}
            perBulan={grafik.granularitas === "bulanan"}
            labelLalu={
              rentang.jenis === "harian"
                ? "14 hari sebelumnya"
                : `${pembanding.penuh.label}`
            }
          />
        </Reveal>
      </div>
    </AppShell>
  );
}
