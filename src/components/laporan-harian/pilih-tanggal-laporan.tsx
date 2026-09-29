"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { dalamBulan, geserBulan, petakBulan } from "@/lib/kalender";
import {
  tanggalLaporanPanjang,
  tanggalLaporanSingkat,
  type KalenderLaporan,
  type StatusHariLaporan,
} from "@/lib/laporan";
import { ambilKalenderLaporan } from "@/app/actions/laporan";

const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** Alamat halaman laporan untuk sebuah tanggal; persona demo ikut dibawa. */
export function tautanTanggalLaporan(
  tanggal: string,
  hariIni: string,
  persona?: string,
) {
  const q = new URLSearchParams();
  if (persona) q.set("persona", persona);
  if (tanggal !== hariIni) q.set("tanggal", tanggal);
  const teks = q.toString();
  return teks ? `/laporan-harian?${teks}` : "/laporan-harian";
}

/** "3 dari 13 sasaran belum dilapor" — untuk label aksesibel & tooltip. */
function uraianStatus(st: StatusHariLaporan) {
  return st.belum > 0
    ? `${st.belum} dari ${st.wajib} sasaran belum dilapor`
    : st.wajib > 1
      ? `semua ${st.wajib} sasaran sudah dilapor`
      : "sudah dilapor";
}

/**
 * Pemilih tanggal laporan berbentuk kalender, lengkap dengan bulan dan
 * tahunnya. Tanggal merah: masih ada sasaran yang belum dilapor. Tanggal
 * hijau: semua sudah. Tanggal merah yang sudah lewat bisa dipilih untuk
 * melapor menyusul; masa depan dan tanggal sebelum sasaran terdaftar di
 * K-Space tidak bisa dipilih.
 */
export function PilihTanggalLaporan({
  hariIni,
  tanggal,
  kalender,
  persona,
}: {
  hariIni: string;
  /** Tanggal yang sedang dilapor. */
  tanggal: string;
  /** Status bulan tempat `tanggal` berada; bulan lain dimuat saat digeser. */
  kalender: KalenderLaporan;
  persona?: string;
}) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [bulan, setBulan] = useState(kalender.bulan);
  const [simpanan, setSimpanan] = useState<Record<string, KalenderLaporan>>({});
  const [memuat, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  // Bulan milik tanggal terpilih selalu memakai data terbaru dari server,
  // supaya warna langsung berubah sesudah laporan terkirim.
  const data = bulan === kalender.bulan ? kalender : simpanan[bulan];
  const bulanMulai = `${kalender.mulai.slice(0, 7)}-01`;
  const bulanIni = `${hariIni.slice(0, 7)}-01`;
  const statusTerpilih = kalender.status[tanggal];

  const merahSebelumnya = Object.entries(kalender.status).filter(
    ([t, st]) => st.belum > 0 && t < hariIni && t !== tanggal,
  ).length;

  const pindahBulan = (tujuan: string) => {
    const aman =
      tujuan < bulanMulai ? bulanMulai : tujuan > bulanIni ? bulanIni : tujuan;
    setBulan(aman);
    setPesan(null);
    if (aman === kalender.bulan || simpanan[aman]) return;
    mulai(async () => {
      const hasil = await ambilKalenderLaporan(aman, persona);
      if (hasil.ok) setSimpanan((s) => ({ ...s, [aman]: hasil.data }));
      else setPesan(hasil.pesan);
    });
  };

  const bukaTutup = (b: boolean) => {
    // Setiap kali dibuka, kalender kembali ke bulan tanggal terpilih.
    if (b) {
      setBulan(kalender.bulan);
      setPesan(null);
    }
    setBuka(b);
  };

  const pilih = (t: string) => {
    setBuka(false);
    if (t !== tanggal) {
      router.push(tautanTanggalLaporan(t, hariIni, persona), { scroll: false });
    }
  };

  const tahun = Number(bulan.slice(0, 4));
  const pilihanTahun = Array.from(
    {
      length: Number(hariIni.slice(0, 4)) - Number(bulanMulai.slice(0, 4)) + 1,
    },
    (_, i) => Number(bulanMulai.slice(0, 4)) + i,
  );

  return (
    <div className="space-y-1.5 text-left">
      <p className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold">
        <CalendarDays className="size-3.5 text-muted-foreground" />
        Tanggal laporan
      </p>

      <Popover open={buka} onOpenChange={bukaTutup}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Tanggal laporan: ${tanggalLaporanPanjang(tanggal)}. Buka kalender`}
            className="tekan-halus flex h-12 w-full items-center gap-2 rounded-xl bg-muted px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {/* Di layar sempit tanggal panjang terpotong oleh penanda status,
                jadi yang tampil bentuk singkatnya — tahunnya tetap ada. */}
            <span className="min-w-0 flex-1 truncate text-[15px] leading-5 font-medium">
              <span className="sm:hidden">
                {tanggalLaporanSingkat(tanggal)} {tanggal.slice(0, 4)}
              </span>
              <span className="hidden sm:inline">
                {tanggalLaporanPanjang(tanggal)}
              </span>
            </span>
            {statusTerpilih ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] leading-[13px] font-semibold",
                  statusTerpilih.belum > 0
                    ? "bg-danger-fill text-danger-text"
                    : "bg-ok-fill text-ok-text",
                )}
              >
                {statusTerpilih.belum > 0 ? "Belum lapor" : "Sudah lapor"}
              </span>
            ) : null}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-80 p-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Bulan sebelumnya"
              disabled={bulan <= bulanMulai}
              onClick={() => pindahBulan(geserBulan(bulan, -1))}
              className="tekan-halus flex size-8 shrink-0 items-center justify-center rounded-full bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <select
              aria-label="Bulan"
              value={bulan.slice(5, 7)}
              onChange={(e) => pindahBulan(`${tahun}-${e.target.value}-01`)}
              className="h-8 min-w-0 flex-1 rounded-lg bg-muted px-2 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {NAMA_BULAN.map((nama, i) => {
                const mm = String(i + 1).padStart(2, "0");
                const b = `${tahun}-${mm}-01`;
                return (
                  <option
                    key={mm}
                    value={mm}
                    disabled={b < bulanMulai || b > bulanIni}
                  >
                    {nama}
                  </option>
                );
              })}
            </select>
            <select
              aria-label="Tahun"
              value={String(tahun)}
              onChange={(e) =>
                pindahBulan(`${e.target.value}-${bulan.slice(5, 7)}-01`)
              }
              className="h-8 w-20 shrink-0 rounded-lg bg-muted px-2 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {pilihanTahun.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Bulan berikutnya"
              disabled={bulan >= bulanIni}
              onClick={() => pindahBulan(geserBulan(bulan, 1))}
              className="tekan-halus flex size-8 shrink-0 items-center justify-center rounded-full bg-muted disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="relative mt-3">
            <div className="grid grid-cols-7 gap-1">
              {HARI.map((h) => (
                <span
                  key={h}
                  className="pb-1 text-center text-[10px] leading-[14px] font-semibold text-muted-foreground"
                >
                  {h}
                </span>
              ))}
              {petakBulan(bulan)
                .flat()
                .map((t) => {
                  if (!dalamBulan(t, bulan)) return <span key={t} />;
                  const st = data?.status[t];
                  const bisa = t <= hariIni && t >= kalender.mulai;
                  const angka = Number(t.slice(8, 10));
                  const kelas = cn(
                    "tabular flex h-9 items-center justify-center rounded-lg text-[13px] leading-[18px] font-semibold",
                    st
                      ? st.belum > 0
                        ? "bg-danger-fill text-danger-text"
                        : "bg-ok-fill text-ok-text"
                      : "text-muted-foreground/45",
                    t === tanggal && "ring-2 ring-primary ring-offset-1",
                    t === hariIni && "underline underline-offset-4",
                  );
                  if (!bisa || !st) {
                    return (
                      <span key={t} aria-hidden className={kelas}>
                        {angka}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => pilih(t)}
                      aria-current={t === tanggal ? "date" : undefined}
                      aria-label={`${tanggalLaporanPanjang(t)}, ${uraianStatus(st)}`}
                      title={uraianStatus(st)}
                      className={cn(kelas, "tekan-halus")}
                    >
                      {angka}
                    </button>
                  );
                })}
            </div>
            {memuat && !data ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-popover/70">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : null}
          </div>

          {pesan ? (
            <p className="mt-2 rounded-lg bg-warn-fill px-2.5 py-1.5 text-[11px] leading-[14px] text-warn-text">
              {pesan}
            </p>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-2">
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-[14px] text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-ok" />
                Sudah lapor
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-danger" />
                Belum lapor
              </li>
            </ul>
            {tanggal !== hariIni ? (
              <button
                type="button"
                onClick={() => pilih(hariIni)}
                className="tekan-halus shrink-0 rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold"
              >
                Hari ini
              </button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
        {merahSebelumnya > 0
          ? `${merahSebelumnya} tanggal lain di ${NAMA_BULAN[Number(kalender.bulan.slice(5, 7)) - 1]} belum lengkap. Buka kalender, lalu pilih tanggal merah untuk melapor susulan.`
          : "Buka kalender untuk melihat tanggal yang sudah (hijau) dan belum (merah) dilapor."}
      </p>
    </div>
  );
}
