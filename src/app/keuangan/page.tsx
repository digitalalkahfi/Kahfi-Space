import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AksesDitolak } from "@/components/layout/akses-ditolak";
import { RingkasanKeuangan } from "@/components/keuangan/ringkasan-keuangan";
import { Waterfall } from "@/components/keuangan/waterfall";
import { PanelDrillDown } from "@/components/keuangan/panel-drill-down";
import { TujuhGrafik } from "@/components/keuangan/tujuh-grafik";
import { GridKpi } from "@/components/keuangan/grid-kpi";
import { PilihRentangPeriode } from "@/components/shared/pilih-rentang-periode";
import { SubMenuFinance } from "@/components/keuangan/sub-menu-finance";
import { DialogTransaksi } from "@/components/keuangan/dialog-transaksi";
import { CatatanDataContoh } from "@/components/shared/catatan-data-contoh";
import { Reveal } from "@/components/motion/reveal";
import { daftarTransaksi, kasAwal } from "@/lib/data/keuangan";
import {
  kontribusiUnit,
  bolehLihatKeuangan,
  ringkasKeuangan,
} from "@/lib/keuangan";
import { denganSeri, kpiFinance, type MasukanKpi } from "@/lib/kpi-finance";
import { seriGrafik } from "@/lib/grafik-finance";
import { bacaDimensi, drillDown } from "@/lib/drill-down";
import { depresiasiPeriode, ringkasDepresiasi } from "@/lib/depresiasi";
import {
  realisasiAnggaran,
  ringkasAnggaran,
  saringAnggaran,
} from "@/lib/budget";
import { daftarAnggaran } from "@/lib/data/budget";
import { daftarAset } from "@/lib/data/aset";
import {
  bacaJenisPeriode,
  prorata,
  rentangPeriode,
  satuanPeriode,
  rentangSebelumnya,
  type RentangPeriode,
} from "@/lib/periode-finance";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Keuangan — K-Space V2",
  description:
    "Kas, laba bersih, dan NPM terhadap net revenue beserta transaksinya.",
};

export default async function KeuanganPage({
  searchParams,
}: PageProps<"/keuangan">) {
  const params = await searchParams;
  const { persona } = params;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  // Angka perusahaan: hanya Finance, Manager, dan CEO.
  if (!bolehLihatKeuangan(pengguna.role)) {
    return (
      <AksesDitolak
        pengguna={pengguna}
        halaman="Keuangan"
        siapa="Finance, Manager, dan CEO"
      />
    );
  }

  const tanggal =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const [transaksi, pilihan, aset, anggaran] = await Promise.all([
    daftarTransaksi(pengguna),
    pilihanOrganisasi(),
    daftarAset(pengguna),
    daftarAnggaran(pengguna),
  ]);
  // Rentang periode dibaca dari URL (PRD Fase 4). Saldo kas tetap posisi
  // perusahaan apa adanya — ia tidak mengenal periode.
  // Acuan bisa digeser lewat tombol periode; bawaannya hari berjalan.
  const acuanDiminta = Array.isArray(params.acuan)
    ? params.acuan[0]
    : params.acuan;
  const acuan = /^\d{4}-\d{2}-\d{2}$/.test(acuanDiminta ?? "")
    ? acuanDiminta!
    : tanggal;

  const rentang = rentangPeriode(bacaJenisPeriode(params.periode), acuan, {
    dari: Array.isArray(params.dari) ? params.dari[0] : params.dari,
    sampai: Array.isArray(params.sampai) ? params.sampai[0] : params.sampai,
  });
  const sebelumnya = rentangSebelumnya(rentang);

  const dalamRentang = transaksi.filter(
    (t) => t.tanggal >= rentang.dari && t.tanggal <= rentang.sampai,
  );
  const dalamRentangLalu = transaksi.filter(
    (t) => t.tanggal >= sebelumnya.dari && t.tanggal <= sebelumnya.sampai,
  );

  const saldoAwal = await kasAwal();
  const posisi = ringkasKeuangan(transaksi, saldoAwal);
  const ringkas = {
    ...ringkasKeuangan(dalamRentang),
    saldoKas: posisi.saldoKas,
  };

  // Angka satu periode hampir tidak pernah cukup untuk memutuskan apa
  // pun; arah perubahannya yang menggerakkan.
  const ringkasLalu = ringkasKeuangan(dalamRentangLalu);

  // Seluruh KPI mengikuti rentang yang dipilih — termasuk dua angka
  // yang aslinya dicatat per bulan: pagu anggaran dan beban penyusutan.
  // Keduanya diprorata sesuai panjang rentang, sebab membandingkan
  // belanja sepekan dengan pagu sebulan selalu menghasilkan hijau palsu.
  const susunMasukan = (r: RentangPeriode): MasukanKpi => {
    const lalu = rentangSebelumnya(r);
    const dalam = (x: { dari: string; sampai: string }) =>
      ringkasKeuangan(
        transaksi.filter((t) => t.tanggal >= x.dari && t.tanggal <= x.sampai),
      );

    const anggaranBulan = ringkasAnggaran(
      realisasiAnggaran(
        saringAnggaran(anggaran, {
          periode: r.dari.slice(0, 7),
          unit: "semua",
        }),
        transaksi,
      ),
    );

    return {
      sekarang: dalam(r),
      sebelumnya: dalam(lalu),
      depresiasi: prorata(
        ringkasDepresiasi(depresiasiPeriode(aset, r.dari.slice(0, 7))).beban,
        r,
      ),
      depresiasiLalu: prorata(
        ringkasDepresiasi(depresiasiPeriode(aset, lalu.dari.slice(0, 7))).beban,
        lalu,
      ),
      anggaran: prorata(anggaranBulan.anggaran, r),
      // Realisasi dihitung dari transaksi dalam rentangnya sendiri,
      // bukan diprorata: belanja memang terjadi pada tanggalnya.
      realisasi: dalam(r).beban + dalam(r).directCost + dalam(r).creatorShare,
      saldoKas: posisi.saldoKas,
    };
  };

  const masukanKpi = susunMasukan(rentang);
  const dimensi = bacaDimensi(params.drill);

  // Riwayat enam periode untuk sparkline; dihitung dengan fungsi yang
  // sama, supaya garisnya tidak pernah bercerita lain dari angkanya.
  const riwayat: MasukanKpi[] = [];
  const labelRiwayat: string[] = [];
  let langkah = rentang;
  for (let i = 0; i < 6; i += 1) {
    riwayat.unshift(susunMasukan(langkah));
    // Label pendek: kolom grafik tidak muat menampung rentang penuh.
    labelRiwayat.unshift(
      langkah.jenis === "tahunan"
        ? langkah.label
        : langkah.label.split(" – ")[0].replace(/ \d{4}$/, ""),
    );
    langkah = rentangSebelumnya(langkah);
  }

  const kpi = denganSeri(kpiFinance(masukanKpi), riwayat);

  return (
    <AppShell pengguna={pengguna} halaman="Keuangan">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Keuangan
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Beban dan aset dipisahkan sejak awal — pencampuran keduanya yang
              membuat NPM sistem lama keliru.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/keuangan/waterfall"
              className="tekan-halus sentuh-nyaman inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-4 text-[11px] leading-[14px] font-semibold ring-1 ring-border-subtle"
            >
              <BarChart3 className="size-3.5" />
              Waterfall
            </Link>

            <DialogTransaksi
              pilihan={pilihan}
              saldoKas={ringkas.saldoKas}
              tanggalBawaan={tanggal}
            />
          </div>
        </div>

        <SubMenuFinance />

        <PilihRentangPeriode rentang={rentang} hariIni={tanggal} />

        <CatatanDataContoh />

        {dalamRentang.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-subtle px-4 py-3 text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Tidak ada transaksi pada {rentang.label}. Angka di bawah wajar nol —
            geser periodenya, atau catat transaksi pertamanya.
          </p>
        ) : null}

        <Reveal>
          <GridKpi
            daftar={kpi}
            labelPeriode={rentang.label}
            labelPembanding={sebelumnya.label}
          />
        </Reveal>

        <Reveal>
          <RingkasanKeuangan
            ringkas={ringkas}
            sebelumnya={ringkasLalu}
            labelPembanding={sebelumnya.label}
          />
        </Reveal>

        <Reveal>
          <Waterfall ringkas={ringkas} />
        </Reveal>

        <Reveal>
          <PanelDrillDown
            dimensi={dimensi}
            baris={drillDown(dalamRentang, dimensi)}
          />
        </Reveal>

        <Reveal>
          <TujuhGrafik
            seri={seriGrafik(riwayat, labelRiwayat)}
            kontribusi={kontribusiUnit(dalamRentang)}
            satuan={satuanPeriode(rentang.jenis)}
            labelPeriode={rentang.label}
          />
        </Reveal>
      </div>
    </AppShell>
  );
}
