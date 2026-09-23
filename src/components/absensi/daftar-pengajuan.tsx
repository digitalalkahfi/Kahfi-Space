"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Stethoscope, UserRoundCheck, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalPendek } from "@/lib/format";
import { putuskanIzin } from "@/app/actions/absensi";
import { MIN_ALASAN_TOLAK } from "@/lib/izin";
import type { PengajuanIzin } from "@/lib/data/absensi";

const LABEL_JENIS: Record<PengajuanIzin["jenis"], string> = {
  sakit: "Sakit",
  izin: "Izin",
  jam: "Izin berjam",
};

/** Satu baris tanggal yang menyebut bentuk pengajuannya apa adanya. */
function rentangPengajuan(p: PengajuanIzin) {
  if (p.jenis === "jam") {
    return `${tanggalPendek(p.tanggal)} · ${p.jamMulai?.slice(0, 5)}–${p.jamSelesai?.slice(0, 5)}`;
  }
  if (p.sampai !== p.tanggal) {
    return `${tanggalPendek(p.tanggal)} – ${tanggalPendek(p.sampai)}`;
  }
  return tanggalPendek(p.tanggal);
}

/** Antrean persetujuan izin untuk atasan. */
export function DaftarPengajuan({ pengajuan }: { pengajuan: PengajuanIzin[] }) {
  const [, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  // Penolakan wajib beralasan, jadi kotaknya dibuka dulu — bukan menolak
  // lebih dahulu lalu memunculkan galat dari database.
  const [menolak, setMenolak] = useState<string | null>(null);
  const [alasanTolak, setAlasanTolak] = useState("");

  const [daftar, putusOptimis] = useOptimistic(
    pengajuan,
    (kini: PengajuanIzin[], id: string) => kini.filter((p) => p.id !== id),
  );

  const putuskan = (
    id: string,
    keputusan: "disetujui" | "ditolak",
    alasan = "",
  ) => {
    mulai(async () => {
      putusOptimis(id);
      const hasil = await putuskanIzin(id, keputusan, alasan);
      setPesan(hasil.pesan ?? null);
      setMenolak(null);
      setAlasanTolak("");
    });
  };

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Pengajuan menunggu keputusan
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {daftar.length === 0
              ? "Tidak ada pengajuan yang tertunda."
              : `${daftar.length} pengajuan dari tim yang kamu bawahi.`}
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <UserRoundCheck className="size-4" />
        </span>
      </div>

      {daftar.length > 0 ? (
        <ul className="space-y-2 px-5">
          {daftar.map((p) => (
            <li
              key={p.id}
              className="baris-interaktif rounded-2xl bg-muted/60 p-3.5"
            >
              <div className="flex items-start gap-3">
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="bg-card text-[11px] font-semibold text-muted-foreground">
                    {p.inisial}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm leading-5 font-semibold">{p.nama}</p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-[13px] font-semibold",
                        p.jenis === "sakit"
                          ? "bg-info-fill text-info-text"
                          : p.jenis === "jam"
                            ? "bg-warn-fill text-warn-text"
                            : "bg-accentmuted-fill text-accentmuted-text",
                      )}
                    >
                      <Stethoscope className="size-2.5" />
                      {LABEL_JENIS[p.jenis]}
                    </span>
                  </div>
                  <p className="tabular text-[11px] leading-[14px] text-muted-foreground">
                    {rentangPengajuan(p)} · {p.unit}
                  </p>
                  <p className="mt-1 text-[13px] leading-[18px] text-pretty">
                    {p.alasan}
                  </p>

                  <div className="mt-2.5 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => putuskan(p.id, "disetujui")}
                      className="tekan-halus sentuh-nyaman h-8 rounded-full px-3 text-[11px] font-semibold"
                    >
                      <Check className="size-3" />
                      Setujui
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setMenolak(menolak === p.id ? null : p.id)}
                      aria-expanded={menolak === p.id}
                      className="tekan-halus sentuh-nyaman h-8 rounded-full px-3 text-[11px] font-semibold"
                    >
                      <X className="size-3" />
                      Tolak
                    </Button>
                  </div>

                  {menolak === p.id ? (
                    <div className="mt-2.5 space-y-1.5">
                      <label
                        htmlFor={`alasan-tolak-${p.id}`}
                        className="text-[11px] leading-[14px] font-semibold"
                      >
                        Alasan penolakan
                      </label>
                      <textarea
                        id={`alasan-tolak-${p.id}`}
                        rows={2}
                        maxLength={300}
                        value={alasanTolak}
                        onChange={(e) => setAlasanTolak(e.target.value)}
                        placeholder="Mis. pekan itu jadwal penutupan bulan, ajukan pekan depan."
                        className="w-full resize-none rounded-xl bg-card px-3 py-2 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] leading-[14px] text-muted-foreground">
                          {alasanTolak.trim().length < MIN_ALASAN_TOLAK
                            ? `Minimal ${MIN_ALASAN_TOLAK} karakter — pengaju perlu tahu sebabnya.`
                            : "Siap dikirim."}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            alasanTolak.trim().length < MIN_ALASAN_TOLAK
                          }
                          onClick={() => putuskan(p.id, "ditolak", alasanTolak)}
                          className="tekan-halus sentuh-nyaman h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold"
                        >
                          Kirim penolakan
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {pesan ? (
        <p
          role="status"
          className="px-5 text-[11px] leading-[14px] text-muted-foreground"
        >
          {pesan}
        </p>
      ) : null}
    </Card>
  );
}
