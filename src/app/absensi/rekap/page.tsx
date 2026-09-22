import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { TabelRekapAbsensi } from "@/components/absensi/tabel-rekap";
import { rekapAbsensi } from "@/lib/data/absensi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { modeData } from "@/lib/supabase/config";
import { tanggalPendek } from "@/lib/format";
import { bacaPeriode } from "@/lib/periode";
import { PilihRentang } from "@/components/shared/pilih-rentang";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Rekap Kehadiran — K-Space V2",
  description: "Rekap kehadiran per periode, siap diunduh ke Excel.",
};

/** Peran yang berhak melihat rekap seluruh tim. */
const LIHAT_TIM = ["CEO", "Manager", "Leader", "Co-Leader"];

export default async function RekapAbsensiPage({
  searchParams,
}: PageProps<"/absensi/rekap">) {
  const { persona, cakupan, periode, dari, sampai } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const bolehTim = LIHAT_TIM.includes(pengguna.role);
  const hanyaSaya = !bolehTim || cakupan === "saya";

  const acuan =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);
  const rentang = bacaPeriode(acuan, { periode, dari, sampai });

  const baris = await rekapAbsensi(
    pengguna,
    rentang.dari,
    rentang.sampai,
    hanyaSaya,
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

          {bolehTim ? (
            <div className="flex items-center gap-1 rounded-full bg-card p-1 ring-1 ring-border-subtle">
              {[
                { kunci: "tim", label: "Tim" },
                { kunci: "saya", label: "Saya" },
              ].map((o) => {
                const aktif = (cakupan ?? "tim") === o.kunci;
                return (
                  <Link
                    key={o.kunci}
                    href={`/absensi/rekap?cakupan=${o.kunci}&periode=${rentang.kunci}&dari=${rentang.dari}&sampai=${rentang.sampai}${
                      peranValid(persona) ? `&persona=${persona}` : ""
                    }`}
                    className={`tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold ${
                      aktif
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {o.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <Suspense fallback={null}>
          <PilihRentang periode={rentang} />
        </Suspense>

        {baris.length === 0 ? (
          <p className="rounded-2xl bg-card px-5 py-4 text-[13px] leading-[18px] text-muted-foreground ring-1 ring-border-subtle">
            Belum ada catatan kehadiran pada rentang ini.
          </p>
        ) : (
          <TabelRekapAbsensi baris={baris} bolehLihatTim={!hanyaSaya} />
        )}
      </div>
    </AppShell>
  );
}
