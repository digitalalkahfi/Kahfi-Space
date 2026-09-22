"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Send, Store, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputGmv } from "@/components/laporan-harian/input-gmv";
import { KolomCatatan } from "@/components/laporan-harian/kolom-catatan";
import {
  PemilihSasaran,
  kunciSasaran,
  labelSasaran,
  targetSasaran,
} from "@/components/laporan-harian/pemilih-sasaran";
import { cn } from "@/lib/utils";
import { persen, rasioCapaian, rupiahPenuh, rupiahRingkas } from "@/lib/format";
import { kirimLaporanHarian } from "@/app/actions/laporan";
import type { SasaranLaporan } from "@/lib/types";

/**
 * Satu-satunya tempat input GMV (PRD §2). Angka diketik manual sambil
 * melihat Partner Center — tidak ada integrasi API.
 */
export function FormLaporan({
  sasaran,
  sudahDilaporkan,
  tanggal,
  terkirim,
  onUbahTerkirim,
}: {
  sasaran: SasaranLaporan[];
  tanggal: string;
  /** Kunci sasaran yang laporannya sudah masuk hari ini. */
  sudahDilaporkan: string[];
  terkirim: boolean;
  /** Dipakai induk untuk membuka kunci Absen Pulang. */
  onUbahTerkirim: (nilai: boolean) => void;
}) {
  const pertamaTersedia =
    sasaran.find((s) => !sudahDilaporkan.includes(kunciSasaran(s))) ??
    sasaran[0];
  const [dipilih, setDipilih] = useState(
    pertamaTersedia ? kunciSasaran(pertamaTersedia) : "",
  );
  const [nilai, setNilai] = useState(0);
  const [catatan, setCatatan] = useState("");
  const [mengirim, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const aktif = useMemo(
    () => sasaran.find((s) => kunciSasaran(s) === dipilih),
    [sasaran, dipilih],
  );

  const target = aktif ? targetSasaran(aktif) : 0;
  const rasio = rasioCapaian(nilai, target);
  const selisih = nilai - target;
  // Catatan opsional — yang wajib hanya sasaran dan angka GMV.
  const siap = Boolean(aktif) && nilai > 0;

  if (terkirim) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="space-y-3 px-5 py-2 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-fill text-ok-text">
            <CheckCircle2 className="size-6" />
          </span>
          <div>
            <h2 className="text-base leading-6 font-semibold">
              Laporan harian terkirim
            </h2>
            <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
              {aktif ? labelSasaran(aktif) : ""} · {rupiahPenuh(nilai)}. Tombol
              Absen Pulang sekarang terbuka.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => onUbahTerkirim(false)}
            className="tekan-halus h-10 rounded-full px-5 text-[13px] font-semibold"
          >
            Perbaiki laporan
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Input GMV Hari Ini
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Sumber angka: TikTok Shop Partner Center
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info-fill text-info-text">
          <Store className="size-4" />
        </span>
      </div>

      <form
        className="space-y-4 px-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!siap || mengirim) return;
          setPesan(null);
          mulai(async () => {
            const hasil = await kirimLaporanHarian({
              sasaran: dipilih,
              gmv: nilai,
              catatan,
              tanggal,
            });
            if (hasil.ok) {
              onUbahTerkirim(true);
            } else if (hasil.kode === "demo") {
              // Mode demo: alurnya tetap diperlihatkan, datanya tidak disimpan.
              setPesan(hasil.pesan);
              onUbahTerkirim(true);
            } else {
              setPesan(hasil.pesan);
            }
          });
        }}
      >
        <div className="space-y-1.5">
          <label
            htmlFor="sasaran"
            className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold"
          >
            <Store className="size-3.5 text-muted-foreground" />
            Pilih akun atau unit
          </label>
          <PemilihSasaran
            sasaran={sasaran}
            nilai={dipilih}
            onUbah={setDipilih}
            sudahDilaporkan={sudahDilaporkan}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="gmv"
              className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold"
            >
              <Wallet className="size-3.5 text-muted-foreground" />
              Nilai realisasi GMV
            </label>
            <span className="tabular text-[11px] leading-[14px] font-semibold text-ok-text">
              Target {rupiahRingkas(target)}
            </span>
          </div>

          <InputGmv
            nilai={nilai}
            onUbah={setNilai}
            suffix={
              nilai > 0 ? (
                <span
                  className={cn(
                    "tabular shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                    selisih >= 0
                      ? "bg-ok-fill text-ok-text"
                      : "bg-danger-fill text-danger-text",
                  )}
                >
                  {selisih >= 0 ? "+" : "-"}
                  {rupiahRingkas(Math.abs(selisih), { prefix: false })}
                </span>
              ) : null
            }
          />

          {nilai > 0 ? (
            <p
              id="gmv-bantuan"
              className="tabular text-[11px] leading-[14px] text-muted-foreground"
            >
              {persen(rasio)} dari target harian · {rupiahPenuh(nilai)}
            </p>
          ) : (
            <p
              id="gmv-bantuan"
              className="text-[11px] leading-[14px] text-muted-foreground"
            >
              Buka Partner Center, salin angka GMV hari ini apa adanya.
            </p>
          )}
        </div>

        <KolomCatatan nilai={catatan} onUbah={setCatatan} />

        <p
          className={cn(
            "text-[11px] leading-[14px]",
            siap ? "font-semibold text-ok-text" : "text-muted-foreground",
          )}
        >
          {siap ? "Siap dikirim" : "Isi nilai GMV dulu untuk mengirim laporan"}
        </p>

        {pesan ? (
          <p
            role="status"
            className="rounded-xl bg-warn-fill px-4 py-2.5 text-[13px] leading-[18px] text-warn-text"
          >
            {pesan}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={!siap || mengirim}
          className="tekan-halus h-14 w-full rounded-full text-[13px] font-semibold"
        >
          {mengirim ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {mengirim ? "Mengirim…" : "Kirim laporan harian & buka Absen Pulang"}
        </Button>
      </form>
    </Card>
  );
}
