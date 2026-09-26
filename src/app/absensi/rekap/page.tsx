import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { RekapPerOrang } from "@/components/absensi/rekap-per-orang";
import { TabelRekapAbsensi } from "@/components/absensi/tabel-rekap";
import { PilihRentang } from "@/components/shared/pilih-rentang";
import { rekapAbsensi } from "@/lib/data/absensi";
import { rekapKehadiranOrang } from "@/lib/data/rekap-kehadiran";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";
import { tanggalPendek } from "@/lib/format";
import { bacaPeriode } from "@/lib/periode";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Rekap Kehadiran — K-Space V2",
  description:
    "Siapa hadir, siapa tidak, dan keterangannya per orang; siap diunduh ke Excel.",
};

/** Peran yang berhak melihat rekap seluruh tim yang ia bawahi. */
const LIHAT_TIM = ["CEO", "Manager", "Leader", "Co-Leader"];

const pil = (aktif: boolean) =>
  cn(
    "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold",
    aktif
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:text-foreground",
  );

export default async function RekapAbsensiPage({
  searchParams,
}: PageProps<"/absensi/rekap">) {
  const { persona, cakupan, periode, dari, sampai, tampilan } =
    await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const bolehTim = LIHAT_TIM.includes(pengguna.role);
  const hanyaSaya = !bolehTim || cakupan === "saya";
  // Per orang adalah tampilan utama: yang tidak absen sama sekali hanya
  // terlihat di sana. Rincian catatan tetap ada untuk menelusuri jam,
  // lokasi, dan laporannya.
  const perOrang = tampilan !== "catatan";

  const acuan =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);
  const rentang = bacaPeriode(acuan, { periode, dari, sampai });

  const [orang, baris] = await Promise.all([
    perOrang
      ? rekapKehadiranOrang(
          pengguna,
          rentang.dari,
          rentang.sampai,
          hanyaSaya,
          acuan,
        )
      : Promise.resolve([]),
    perOrang
      ? Promise.resolve([])
      : rekapAbsensi(pengguna, rentang.dari, rentang.sampai, hanyaSaya),
  ]);

  // Satu parameter diganti, sisanya dipertahankan: berpindah tampilan
  // tidak boleh membuang rentang yang sudah dipilih.
  const tautan = (ubah: Record<string, string>) => {
    const p = new URLSearchParams({
      cakupan: hanyaSaya ? "saya" : "tim",
      tampilan: perOrang ? "orang" : "catatan",
      periode: rentang.kunci,
      dari: rentang.dari,
      sampai: rentang.sampai,
      ...ubah,
    });
    if (peranValid(persona)) p.set("persona", persona);
    return `/absensi/rekap?${p.toString()}`;
  };

  const kosong = (
    <p className="rounded-2xl bg-card px-5 py-4 text-[13px] leading-[18px] text-muted-foreground ring-1 ring-border-subtle">
      Belum ada catatan kehadiran pada rentang ini.
    </p>
  );

  return (
    <AppShell pengguna={pengguna} halaman="Absensi">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Link
          href="/absensi"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Absensi
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Rekap Kehadiran
            </h1>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              {rentang.label} · {tanggalPendek(rentang.dari)} –{" "}
              {tanggalPendek(rentang.sampai)} ·{" "}
              {hanyaSaya ? "kehadiran saya" : "seluruh tim yang saya bawahi"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-card p-1 ring-1 ring-border-subtle">
              <Link
                href={tautan({ tampilan: "orang" })}
                className={pil(perOrang)}
              >
                Per orang
              </Link>
              <Link
                href={tautan({ tampilan: "catatan" })}
                className={pil(!perOrang)}
              >
                Rincian catatan
              </Link>
            </div>

            {bolehTim ? (
              <div className="flex items-center gap-1 rounded-full bg-card p-1 ring-1 ring-border-subtle">
                <Link
                  href={tautan({ cakupan: "tim" })}
                  className={pil(!hanyaSaya)}
                >
                  Tim
                </Link>
                <Link
                  href={tautan({ cakupan: "saya" })}
                  className={pil(hanyaSaya)}
                >
                  Saya
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <Suspense fallback={null}>
          <PilihRentang periode={rentang} />
        </Suspense>

        {perOrang ? (
          orang.length === 0 ? (
            kosong
          ) : (
            <RekapPerOrang daftar={orang} bolehLihatTim={!hanyaSaya} />
          )
        ) : baris.length === 0 ? (
          kosong
        ) : (
          <TabelRekapAbsensi baris={baris} bolehLihatTim={!hanyaSaya} />
        )}
      </div>
    </AppShell>
  );
}
