import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AksesDitolak } from "@/components/layout/akses-ditolak";
import {
  PanelKesiapan,
  type Penghalang,
} from "@/components/migrasi/panel-kesiapan";
import { KartuPemetaan } from "@/components/migrasi/kartu-pemetaan";
import { RekapKelompok } from "@/components/migrasi/rekap-kelompok";
import { PanelKunciDiabaikan } from "@/components/migrasi/panel-kunci-diabaikan";
import { PanelGmvGabungan } from "@/components/migrasi/panel-gmv-gabungan";
import { Reveal } from "@/components/motion/reveal";
import {
  bolehMigrasi,
  barisKunciEkspor,
  cuplikanKunci,
  hitunganPeta,
  ringkasGmvLama,
  isiEksporLama,
  medanEksporLama,
  persetujuanPemetaan,
} from "@/lib/data/migrasi";
import { rekapPemetaan } from "@/lib/rekap-pemetaan";
import { medanTakTerpetakan, versiPemetaan } from "@/lib/pemetaan";
import { PEMETAAN_INTI, PEMETAAN_V1 } from "@/lib/pemetaan-v1";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Pemetaan Migrasi — K-Space V2",
  description:
    "Pemetaan medan kv_store ke skema baru, beserta persetujuan sebelum dijalankan.",
};

/**
 * Kelompok pemetaan dibagi dua di layar.
 *
 * Sebelas kartu berderet tanpa jeda tidak terbaca sebagai urutan, padahal
 * urutannya bukan hiasan: yang operasional menunjuk orang dan akun, dan
 * keduanya harus benar lebih dulu.
 */
const BAGIAN = [
  {
    judul: "Data inti",
    keterangan:
      "Orang, akun, laporan, dan GMV. Semua kelompok lain menunjuk keempatnya, jadi keempatnya harus benar lebih dulu.",
    kunci: PEMETAAN_INTI.map((p) => p.kunci),
  },
  {
    judul: "Data operasional",
    keterangan:
      "Kehadiran, izin, tugas, todo, dan arus kas. Semuanya menunjuk orang; yang penunjuknya belum tertaut tidak diproses.",
    kunci: PEMETAAN_V1.filter(
      (p) => !PEMETAAN_INTI.some((i) => i.kunci === p.kunci),
    ).map((p) => p.kunci),
  },
];

export default async function PemetaanPage({
  searchParams,
}: PageProps<"/migrasi/pemetaan">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");
  if (!bolehMigrasi(pengguna)) {
    return (
      <AksesDitolak
        pengguna={pengguna}
        halaman="Pemetaan Migrasi"
        siapa="CEO dan Manager"
      />
    );
  }

  const [
    medanPerKunci,
    persetujuan,
    isiEkspor,
    dipindahkan,
    kunciEkspor,
    gmv,
    cuplikan,
  ] = await Promise.all([
    medanEksporLama(),
    persetujuanPemetaan(),
    isiEksporLama(),
    hitunganPeta(),
    barisKunciEkspor(),
    ringkasGmvLama(),
    cuplikanKunci(),
  ]);

  const rekap = rekapPemetaan(isiEkspor, PEMETAAN_V1, dipindahkan);

  const kartu = PEMETAAN_V1.map((p) => {
    const versi = versiPemetaan(p);
    return {
      pemetaan: p,
      versi,
      // Persetujuan hanya berlaku bila sidik versinya masih cocok.
      persetujuan:
        persetujuan.find((s) => s.entitas === p.kunci && s.versi === versi) ??
        null,
      medanAsing: medanTakTerpetakan(p, medanPerKunci[p.kunci] ?? []),
      // Kunci yang tidak ada di ekspor sama sekali bukan kesalahan
      // pemetaan — bisa jadi memang tidak dipakai di sistem lama.
      adaDiEkspor: p.kunci in medanPerKunci,
    };
  });

  const disetujui = kartu.filter((k) => k.persetujuan !== null).length;
  const menunggu = rekap.reduce((a, r) => a + r.butuhKeputusan, 0);
  const belumDisetujui = kartu.filter((k) => k.persetujuan === null);

  // Apa saja yang menahan migrasi sungguhan, disebut satu per satu
  // beserta jalan menuju tempat menyelesaikannya.
  const penghalang: Penghalang[] = [];
  if (belumDisetujui.length > 0) {
    penghalang.push({
      pesan: `${belumDisetujui.length} kelompok belum disetujui: ${belumDisetujui
        .map((k) => k.pemetaan.label)
        .join(", ")}.`,
    });
  }
  if (menunggu > 0) {
    penghalang.push({
      pesan: `${menunggu} catatan menunggu keputusan orang; selama itu barisnya tidak diproses.`,
      tautan: { href: "/migrasi/orang", label: "Relasi orang" },
    });
  }

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
            Pemetaan entitas
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Medan ekspor K-Space V1 mana menjadi kolom apa di V2. Pemetaan
            menentukan bentuk akhir seluruh data perusahaan, jadi setiap
            kelompok ditinjau dan disetujui lebih dulu.
          </p>
        </div>

        <PanelKesiapan
          disetujui={disetujui}
          total={kartu.length}
          penghalang={penghalang}
        />

        <Reveal>
          <RekapKelompok baris={rekap} />
        </Reveal>

        <Link
          href="/migrasi/orang"
          className="baris-interaktif flex items-center gap-3 rounded-3xl bg-card px-5 py-4 shadow-card ring-1 ring-border-subtle"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-[18px] font-semibold">
              Relasi orang
            </span>
            <span className="block text-[11px] leading-[14px] text-pretty text-muted-foreground">
              Menautkan orang di data lama ke profil V2. Selama belum
              diputuskan, data yang menunjuk mereka tidak diproses.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>

        <Reveal>
          <PanelGmvGabungan dipakai={gmv.dipakai} dilewati={gmv.dilewati} />
        </Reveal>

        <Reveal>
          <PanelKunciDiabaikan baris={kunciEkspor} />
        </Reveal>

        {BAGIAN.map((bagian) => {
          const isi = kartu.filter((k) =>
            bagian.kunci.includes(k.pemetaan.kunci),
          );
          if (isi.length === 0) return null;
          const disetujuiBagian = isi.filter(
            (k) => k.persetujuan !== null,
          ).length;

          return (
            <section key={bagian.judul} className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
                <h2 className="text-base leading-6 font-semibold">
                  {bagian.judul}
                </h2>
                <p className="text-[11px] leading-[14px] text-muted-foreground">
                  {disetujuiBagian}/{isi.length} disetujui
                </p>
              </div>
              <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
                {bagian.keterangan}
              </p>

              {isi.map((k) => (
                <Reveal key={k.pemetaan.kunci}>
                  <KartuPemetaan
                    pemetaan={k.pemetaan}
                    versi={k.versi}
                    persetujuan={k.persetujuan}
                    bolehSetujui
                    medanAsing={k.medanAsing}
                    adaDiEkspor={k.adaDiEkspor}
                    rekap={rekap.find((r) => r.kunci === k.pemetaan.kunci)}
                    cuplikan={cuplikan[k.pemetaan.kunci]}
                  />
                </Reveal>
              ))}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
