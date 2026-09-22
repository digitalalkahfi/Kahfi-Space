"use client";

import { useState, useTransition } from "react";
import { Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  GAYA_STATUS_MASUKAN,
  LABEL_STATUS_MASUKAN,
  type Masukan,
  type StatusMasukan,
} from "@/lib/masukan";
import { ubahStatusMasukan } from "@/app/actions/masukan";
import type { Pengguna } from "@/lib/types";

/**
 * Langkah status yang masuk akal dari keadaan sekarang.
 * Status yang bisa dilompati semaunya membuat papan ini tidak berarti.
 */
const LANJUTAN: Record<StatusMasukan, StatusMasukan[]> = {
  baru: ["ditinjau", "dikerjakan", "ditolak"],
  ditinjau: ["dikerjakan", "ditolak"],
  dikerjakan: ["selesai", "ditinjau"],
  selesai: ["dikerjakan"],
  ditolak: ["ditinjau"],
};

/** Panel penanggung jawab: memindahkan status dan menunjuk petugas. */
export function PanelStatusMasukan({
  masukan,
  anggota,
}: {
  masukan: Masukan;
  anggota: Pick<Pengguna, "id" | "nama" | "jabatan">[];
}) {
  const [tujuan, setTujuan] = useState<StatusMasukan | null>(null);
  const [alasan, setAlasan] = useState(masukan.alasanTolak);
  const [petugas, setPetugas] = useState<string | null>(null);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  const perluAlasan = tujuan === "ditolak";
  // Laporan yang dikerjakan harus bertuan (0094); tanpa itu penyimpanannya
  // ditolak database, jadi lebih baik tombolnya belum bisa ditekan.
  const perluPetugas = tujuan === "dikerjakan";
  const siap =
    (!perluAlasan || alasan.trim().length >= 10) &&
    (!perluPetugas || petugas !== null);

  const simpan = () => {
    if (!tujuan || !siap || menyimpan) return;
    mulai(async () => {
      setPesan(null);
      const hasil = await ubahStatusMasukan({
        masukanId: masukan.id,
        status: tujuan,
        alasanTolak: alasan,
        ditugaskanKe: petugas,
      });
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
      setTujuan(null);
    });
  };

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Tindak lanjut</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Sekarang{" "}
          <span className="font-semibold">
            {LABEL_STATUS_MASUKAN[masukan.status].toLowerCase()}
          </span>
          {masukan.ditugaskanNama
            ? ` · ditangani ${masukan.ditugaskanNama}`
            : " · belum ada penanggung jawab"}
          . Setiap perubahan tercatat dan terlihat pelapornya.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 px-5">
        {LANJUTAN[masukan.status].map((ke) => {
          const gaya = GAYA_STATUS_MASUKAN[ke];
          return (
            <button
              key={ke}
              type="button"
              onClick={() => {
                setPesan(null);
                setTujuan(ke);
              }}
              className={cn(
                "tekan-halus sentuh-nyaman rounded-full px-3.5 py-2 text-[11px] leading-[14px] font-semibold",
                gaya.kelas,
              )}
            >
              Tandai {LABEL_STATUS_MASUKAN[ke].toLowerCase()}
            </button>
          );
        })}
      </div>

      {pesan ? (
        <p
          role="status"
          className={
            berhasil
              ? "mx-5 rounded-2xl bg-ok-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-ok-text"
              : "mx-5 rounded-2xl bg-warn-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-warn-text"
          }
        >
          {pesan}
        </p>
      ) : null}

      <Dialog
        open={tujuan !== null}
        onOpenChange={(b) => {
          if (!b) setTujuan(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Tandai {tujuan ? LABEL_STATUS_MASUKAN[tujuan].toLowerCase() : ""}?
            </DialogTitle>
            <DialogDescription>
              {tujuan === "ditolak"
                ? "Alasannya akan terlihat pelapor — itulah yang menentukan apakah ia mau melapor lagi lain kali."
                : "Perubahan ini muncul di halaman kiriman pelapornya."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {perluPetugas && petugas === null ? (
              <p className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-warn-text">
                Pilih dulu penanggung jawabnya. Laporan yang tercatat sedang
                dikerjakan tanpa ada yang memilikinya hanya menenangkan
                pelapornya, tidak menyelesaikan apa pun.
              </p>
            ) : null}

            {perluAlasan ? (
              <div className="space-y-1.5">
                <label
                  htmlFor="alasan-tolak"
                  className="text-[13px] leading-[18px] font-semibold"
                >
                  Alasan penolakan
                </label>
                <textarea
                  id="alasan-tolak"
                  value={alasan}
                  maxLength={300}
                  rows={3}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Mis. sudah ditangani lewat jalur lain, atau di luar cakupan aplikasi"
                  className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </div>
            ) : (
              <fieldset className="space-y-1.5">
                <legend className="text-[13px] leading-[18px] font-semibold">
                  Penanggung jawab{" "}
                  <span className="font-normal text-muted-foreground">
                    (opsional)
                  </span>
                </legend>
                <div className="max-h-52 space-y-1 overflow-y-auto">
                  {anggota.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setPetugas(petugas === a.id ? null : a.id)}
                      aria-pressed={petugas === a.id}
                      className={cn(
                        "baris-interaktif flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left",
                        petugas === a.id
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "bg-muted/50",
                      )}
                    >
                      <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] leading-[18px] font-semibold">
                          {a.nama}
                        </span>
                        <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                          {a.jabatan}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="tekan-halus rounded-full"
              >
                Batal
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={!siap || menyimpan}
              onClick={simpan}
              className="tekan-halus rounded-full"
            >
              {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
