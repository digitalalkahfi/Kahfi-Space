import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AksesDitolak } from "@/components/layout/akses-ditolak";
import { Card } from "@/components/ui/card";
import { AksiKeputusan } from "@/components/keuangan/aksi-keputusan";
import { JejakKeputusan } from "@/components/keuangan/jejak-keputusan";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { rupiahPenuh, tanggalPendek } from "@/lib/format";
import {
  GAYA_STATUS_TRANSAKSI,
  LABEL_JENIS_KELUAR,
  LABEL_STATUS_TRANSAKSI,
  bolehLihatKeuangan,
  izinPersetujuan,
  penyetujuiWajib,
  ringkasKeuangan,
} from "@/lib/keuangan";
import { daftarTransaksi, jejakKeputusan, kasAwal } from "@/lib/data/keuangan";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Transaksi — K-Space V2",
  description: "Rincian satu transaksi beserta jejak keputusannya.",
};

function Keterangan({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-muted/50 p-3">
      <dt className="text-[11px] leading-[14px] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[13px] leading-[18px] font-semibold text-pretty">
        {children}
      </dd>
    </div>
  );
}

export default async function DetailTransaksiPage({
  params,
  searchParams,
}: PageProps<"/keuangan/[id]">) {
  const [{ id }, { persona }] = await Promise.all([params, searchParams]);
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");
  if (!bolehLihatKeuangan(pengguna.role)) {
    return (
      <AksesDitolak
        pengguna={pengguna}
        halaman="Transaksi"
        siapa="Finance, Manager, dan CEO"
      />
    );
  }

  const [semua, saldoAwal] = await Promise.all([
    daftarTransaksi(pengguna),
    kasAwal(),
  ]);
  const transaksi = semua.find((t) => t.id === id);
  if (!transaksi) notFound();

  const jejak = await jejakKeputusan(transaksi.id);
  const ringkas = ringkasKeuangan(semua, saldoAwal);
  const izin = izinPersetujuan(
    pengguna.role,
    pengguna.id,
    transaksi.diajukanId,
    ringkas.saldoKas,
  );
  const masuk = transaksi.arah === "masuk";

  return (
    <AppShell pengguna={pengguna} halaman="Keuangan">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/keuangan"
          className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] leading-[18px] font-semibold ring-1 ring-border-subtle"
        >
          <ArrowLeft className="size-3.5" />
          Keuangan
        </Link>

        <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
          <div className="flex items-start gap-3 px-5">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                masuk
                  ? "bg-ok-fill text-ok-text"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {masuk ? (
                <ArrowDownLeft className="size-5" />
              ) : (
                <ArrowUpRight className="size-5" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] leading-7 font-bold tracking-tight text-pretty lg:text-[28px] lg:leading-9">
                {transaksi.keterangan}
              </h1>
              <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
                {tanggalPendek(transaksi.tanggal)} · {transaksi.unitNama}
                {transaksi.jenis
                  ? ` · ${LABEL_JENIS_KELUAR[transaksi.jenis]}`
                  : ""}
                {transaksi.akunUsername ? ` · ${transaksi.akunUsername}` : ""}
              </p>
            </div>

            <span
              className={cn(
                "inline-flex h-fit shrink-0 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                GAYA_STATUS_TRANSAKSI[transaksi.status],
              )}
            >
              {LABEL_STATUS_TRANSAKSI[transaksi.status]}
            </span>
          </div>

          <dl className="tabular grid grid-cols-1 gap-2 px-5 sm:grid-cols-2">
            <Keterangan label={masuk ? "Uang masuk" : "Uang keluar"}>
              {masuk ? "+" : "−"}
              {rupiahPenuh(transaksi.jumlah)}
            </Keterangan>
            <Keterangan label="Diajukan">
              {transaksi.diajukanNama ?? "—"}
            </Keterangan>
            <Keterangan label="Diputuskan">
              {transaksi.disetujuiNama ?? "Belum ada keputusan"}
            </Keterangan>
            <Keterangan label="Penyetuju wajib saat ini">
              {penyetujuiWajib(ringkas.saldoKas)}
            </Keterangan>
          </dl>
        </Card>

        <Reveal>
          <AksiKeputusan
            transaksi={transaksi}
            izin={izin}
            bolehBayar={bolehLihatKeuangan(pengguna.role)}
          />
        </Reveal>

        <Reveal>
          <JejakKeputusan daftar={jejak} />
        </Reveal>
      </div>
    </AppShell>
  );
}
