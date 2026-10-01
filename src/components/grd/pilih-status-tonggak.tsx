"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { jamWib, tanggalKalenderPendek, keTanggalWib } from "@/lib/format";
import {
  LABEL_STATUS,
  keadaanTonggak,
  type KeadaanTonggak,
  type StatusTonggak,
  type Tonggak,
} from "@/lib/rencana";
import { ubahStatusTonggak } from "@/app/actions/rencana";

const GAYA_KEADAAN: Record<KeadaanTonggak, string> = {
  tepat: "bg-ok-fill text-ok-text ring-ok-text/20",
  terlambat: "bg-warn-fill text-warn-text ring-warn-text/20",
  lewat: "bg-danger-fill text-danger-text ring-danger-text/20",
  menunggu: "bg-muted text-foreground ring-border-subtle",
  tanpa_tenggat: "bg-muted text-muted-foreground ring-border-subtle",
};

const KET_KEADAAN: Record<KeadaanTonggak, string> = {
  tepat: "Selesai tepat waktu",
  terlambat: "Selesai terlambat",
  lewat: "Lewat tenggat, belum selesai",
  menunggu: "Belum jatuh tempo",
  tanpa_tenggat: "Tenggat belum ditetapkan",
};

const URUTAN: StatusTonggak[] = ["belum", "progress", "selesai"];

/**
 * Satu tonggak sebagai chip: tanggal tenggat (atau judul tahapnya) dan
 * warnanya menurut keadaan. Yang berwenang mengetuknya untuk mengubah
 * status; waktu selesai dicatat database saat dicentang.
 */
export function PilihStatusTonggak({
  tonggak,
  hariIni,
  bolehUbah,
  label,
}: {
  tonggak: Tonggak;
  hariIni: string;
  bolehUbah: boolean;
  label: string;
}) {
  const [buka, setBuka] = useState(false);
  const [status, setStatus] = useState(tonggak.status);
  const [pesan, setPesan] = useState<string | null>(null);
  const [menyimpan, mulai] = useTransition();

  const sekarang = { ...tonggak, status };
  if (status !== tonggak.status) {
    // Tampilan sementara sebelum halaman dimuat ulang dari server.
    sekarang.selesaiPada =
      status === "selesai" ? new Date().toISOString() : null;
  }
  const keadaan = keadaanTonggak(sekarang, hariIni);

  const isi = (
    <>
      {status === "selesai" ? (
        <Check className="size-3 shrink-0" aria-hidden />
      ) : status === "progress" ? (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current"
          aria-hidden
        />
      ) : null}
      <span className="truncate">{label}</span>
    </>
  );

  const kelas = cn(
    "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-1 text-[11px] leading-[14px] font-semibold ring-1",
    GAYA_KEADAAN[keadaan],
  );
  const judul = `${tonggak.judul} — ${LABEL_STATUS[status]} · ${KET_KEADAAN[keadaan]}`;

  if (!bolehUbah) {
    return (
      <span className={kelas} title={judul}>
        {isi}
      </span>
    );
  }

  const pilih = (baru: StatusTonggak) => {
    if (baru === status) return setBuka(false);
    const lama = status;
    setStatus(baru);
    setPesan(null);
    mulai(async () => {
      const hasil = await ubahStatusTonggak({
        tonggakId: tonggak.id,
        status: baru,
      });
      if (!hasil.ok) {
        setStatus(lama);
        setPesan(hasil.pesan);
        return;
      }
      setBuka(false);
    });
  };

  return (
    <Popover open={buka} onOpenChange={setBuka}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(kelas, "tekan-halus cursor-pointer")}
          title={judul}
          aria-label={`Ubah status: ${judul}`}
        >
          {menyimpan ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : null}
          {isi}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3 p-3">
        <div>
          <p className="text-[13px] leading-[18px] font-semibold">
            {tonggak.judul}
          </p>
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            {tonggak.tenggat
              ? `Tenggat ${tanggalKalenderPendek(tonggak.tenggat, hariIni)}`
              : "Tenggat belum ditetapkan"}
            {tonggak.status === "selesai" && tonggak.selesaiPada
              ? ` · dicentang ${tanggalKalenderPendek(keTanggalWib(tonggak.selesaiPada), hariIni)} ${jamWib(tonggak.selesaiPada)}`
              : ""}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {URUTAN.map((s) => (
            <button
              key={s}
              type="button"
              disabled={menyimpan}
              onClick={() => pilih(s)}
              className={cn(
                "tekan-halus rounded-lg px-2 py-1.5 text-[12px] leading-4 font-semibold",
                s === status
                  ? "bg-card text-foreground shadow-card ring-1 ring-border-subtle"
                  : "text-muted-foreground",
              )}
            >
              {LABEL_STATUS[s]}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-[14px] text-muted-foreground">
          Waktu selesai dicatat saat dicentang. Tepat waktu bila tanggalnya
          (WIB) tidak melewati tenggat.
        </p>
        {pesan ? (
          <p className="text-[11px] leading-[14px] font-semibold text-danger-text">
            {pesan}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
