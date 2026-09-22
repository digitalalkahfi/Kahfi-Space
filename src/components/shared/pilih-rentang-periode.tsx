"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  JENIS_PERIODE,
  LABEL_PERIODE,
  geserRentang,
  hariDalamRentang,
  rentangPeriode,
  type JenisPeriode,
  type RentangPeriode,
} from "@/lib/periode-finance";

/**
 * Filter periode: harian, mingguan, bulanan, tahunan, dan rentang
 * kustom.
 *
 * Ada di dalam modul, bukan di navigasi atas — "bulan ini" berarti lain
 * di tiap modul, dan filter global membuat orang mengira seluruh
 * aplikasi sedang melihat rentang yang sama.
 *
 * Tinggal di `shared/` karena dipakai dua modul: dasbor Finance dan
 * dasbor Analitik GMV. Tidak ada satu pun keputusan khusus Finance di
 * dalamnya — seluruh keadaannya ada di URL, jadi pemanggil bebas
 * menafsirkan rentangnya sendiri.
 */
/** Rentang yang paling sering diminta saat memilih tanggal sendiri. */
const PINTASAN_KUSTOM = [
  { hari: 7, label: "7 hari terakhir" },
  { hari: 30, label: "30 hari terakhir" },
  { hari: 90, label: "90 hari terakhir" },
];

/** Mundur `n` hari dari sebuah tanggal ISO, bebas zona waktu. */
function mundurHari(tanggal: string, n: number): string {
  const [t, b, h] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(t, b - 1, h - n)).toISOString().slice(0, 10);
}

export function PilihRentangPeriode({
  rentang,
  hariIni,
}: {
  rentang: RentangPeriode;
  /** Tanggal acuan aplikasi; tombol "sekarang" kembali ke sini. */
  hariIni: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Mengganti periode adalah navigasi ke server; tanpa penanda apa pun,
  // rentang besar terasa seperti tombol yang tidak bereaksi. Kerangka
  // isi ditangani Suspense di halamannya; yang ini menandai kontrolnya.
  const [menunggu, mulai] = useTransition();
  // Acuan yang akan dipakai halaman kalau tombol ini ditekan: `acuan`
  // dari URL bila ada, kalau tidak hari ini. Harus persis aturan yang
  // sama dengan halamannya, kalau tidak ancar-ancar di tooltip akan
  // menyebut tanggal yang bukan hasilnya.
  const acuanKini = params.get("acuan") ?? hariIni;
  // `rentangPeriode` menukar rentang kustom yang terbalik supaya
  // halamannya tetap bisa menghitung; yang tidak boleh adalah
  // menukarnya diam-diam tanpa memberi tahu.
  const dariDiminta = params.get("dari") ?? "";
  const sampaiDiminta = params.get("sampai") ?? "";
  const terbalik =
    rentang.jenis === "custom" &&
    dariDiminta !== "" &&
    sampaiDiminta !== "" &&
    sampaiDiminta < dariDiminta;

  const pindah = (ubah: Record<string, string>) => {
    const baru = new URLSearchParams(params.toString());
    for (const [kunci, nilai] of Object.entries(ubah)) {
      if (!nilai) baru.delete(kunci);
      else baru.set(kunci, nilai);
    }
    const query = baru.toString();
    mulai(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  };

  return (
    <div
      className="space-y-2"
      aria-busy={menunggu}
      // Selama menunggu, kontrolnya diredupkan sedikit — cukup untuk
      // terbaca sebagai "sedang jalan", tidak sampai mengunci.
      data-menunggu={menunggu ? "" : undefined}
    >
      <div
        role="group"
        aria-label="Jenis periode"
        className={cn(
          "-mx-1 flex gap-1 overflow-x-auto rounded-full bg-muted p-1 transition-opacity",
          menunggu && "opacity-60",
        )}
      >
        {JENIS_PERIODE.map((j: JenisPeriode) => {
          // Rentang yang akan dihasilkan tombol ini, dihitung dengan
          // fungsi yang sama yang nanti dipakai halamannya — supaya
          // ancar-ancarnya tidak pernah berbeda dari hasilnya. Orang
          // tidak perlu menekan dulu untuk tahu "Tahunan" itu sampai
          // tanggal berapa.
          const hasil =
            j === "custom"
              ? null
              : rentangPeriode(j, acuanKini, {
                  dari: rentang.dari,
                  sampai: rentang.sampai,
                });

          return (
            <button
              key={j}
              type="button"
              onClick={() => pindah({ periode: j })}
              aria-pressed={j === rentang.jenis}
              title={hasil ? hasil.label : "Tentukan tanggal mulai dan selesai"}
              className={cn(
                "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
                j === rentang.jenis
                  ? "bg-card text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {LABEL_PERIODE[j]}
            </button>
          );
        })}
      </div>

      {/* Geser periode tanpa menyunting URL: menelusuri enam bulan ke
          belakang adalah pekerjaan sehari-hari, bukan kasus khusus. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            const lalu = geserRentang(rentang, -1);
            pindah({ acuan: lalu.dari, dari: lalu.dari, sampai: lalu.sampai });
          }}
          aria-label="Periode sebelumnya"
          className="tekan-halus sentuh-nyaman flex size-8 items-center justify-center rounded-full bg-card ring-1 ring-border-subtle"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        <span className="tabular min-w-0 flex-1 text-[11px] leading-[14px] font-semibold">
          {rentang.label}
        </span>

        <button
          type="button"
          onClick={() => {
            const depan = geserRentang(rentang, 1);
            pindah({
              acuan: depan.dari,
              dari: depan.dari,
              sampai: depan.sampai,
            });
          }}
          aria-label="Periode berikutnya"
          className="tekan-halus sentuh-nyaman flex size-8 items-center justify-center rounded-full bg-card ring-1 ring-border-subtle"
        >
          <ChevronRight className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={() => pindah({ acuan: "", dari: "", sampai: "" })}
          className="tekan-halus sentuh-nyaman inline-flex h-8 items-center gap-1.5 rounded-full bg-card px-3 text-[11px] leading-[14px] font-semibold ring-1 ring-border-subtle"
        >
          <RotateCcw className="size-3" />
          Sekarang
        </button>
      </div>

      {rentang.jenis === "custom" ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] leading-[14px] text-muted-foreground">
            <input
              type="date"
              value={rentang.dari}
              onChange={(e) => pindah({ dari: e.target.value })}
              aria-label="Dari tanggal"
              className="h-9 rounded-xl bg-muted px-2.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <span aria-hidden>–</span>
            <input
              type="date"
              value={rentang.sampai}
              onChange={(e) => pindah({ sampai: e.target.value })}
              aria-label="Sampai tanggal"
              className="h-9 rounded-xl bg-muted px-2.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          {/* Pintasan untuk rentang yang paling sering diminta; tanpa
              ini orang harus memutar dua pemilih tanggal hanya untuk
              melihat sepekan terakhir. */}
          <div className="flex flex-wrap gap-1.5">
            {PINTASAN_KUSTOM.map((p) => (
              <button
                key={p.hari}
                type="button"
                onClick={() => {
                  const mulai = mundurHari(hariIni, p.hari - 1);
                  pindah({ dari: mulai, sampai: hariIni, acuan: mulai });
                }}
                className="tekan-halus sentuh-nyaman rounded-full bg-card px-2.5 py-1 text-[11px] leading-[14px] font-semibold ring-1 ring-border-subtle hover:text-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>

          <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
            {hariDalamRentang(rentang)} hari dalam rentang ini.
          </p>

          {terbalik ? (
            <p className="text-[11px] leading-[14px] text-pretty text-warn-text">
              Tanggal akhir mendahului tanggal mulai, jadi keduanya ditukar.
            </p>
          ) : null}

          {rentang.sampai > hariIni ? (
            <p className="text-[11px] leading-[14px] text-pretty text-warn-text">
              Rentang ini melewati hari ini — bagian yang belum terjadi wajar
              kosong.
            </p>
          ) : null}
        </div>
      ) : rentang.dari > hariIni ? (
        <p className="text-[11px] leading-[14px] text-pretty text-warn-text">
          Periode ini belum berjalan — angkanya wajar kosong.
        </p>
      ) : null}
    </div>
  );
}
