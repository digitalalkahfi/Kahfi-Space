"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Loader2, MoveRight } from "lucide-react";
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
  GAYA_STATUS_SAMPEL,
  LABEL_STATUS_SAMPEL,
  LANJUTAN,
  type Sampel,
  type StatusSampel,
} from "@/lib/sampel";
import { catatPerpindahan } from "@/app/actions/sampel";
import type { Pengguna } from "@/lib/types";

/** Apa yang perlu diisi untuk tiap tujuan perpindahan. */
function butuh(ke: StatusSampel) {
  return {
    pemegang: ke === "dipegang",
    kreator: ke === "dikirim" || ke === "diterima",
    catatanWajib: ke === "hilang",
  };
}

/**
 * Aksi cepat memindahkan sampel.
 *
 * Hanya langkah yang memang mungkin dari keadaan sekarang yang
 * ditawarkan — menampilkan tombol yang pasti ditolak database hanya
 * membuat orang menebak-nebak apa yang salah.
 */
export function AksiPerpindahan({
  sampel,
  anggota,
}: {
  sampel: Sampel;
  anggota: Pick<Pengguna, "id" | "nama" | "jabatan">[];
}) {
  const [tujuan, setTujuan] = useState<StatusSampel | null>(null);
  const [pemegangId, setPemegangId] = useState<string | null>(
    sampel.pemegangId,
  );
  const [kreator, setKreator] = useState(sampel.kreator);
  const [catatan, setCatatan] = useState("");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  const pilihan = LANJUTAN[sampel.status];
  const perlu = tujuan ? butuh(tujuan) : null;

  const siap =
    tujuan !== null &&
    (!perlu?.pemegang || pemegangId !== null) &&
    (!perlu?.kreator || kreator.trim() !== "") &&
    (!perlu?.catatanWajib || catatan.trim().length >= 10);

  const simpan = () => {
    if (!tujuan || !siap || menyimpan) return;
    mulai(async () => {
      setPesan(null);
      const hasil = await catatPerpindahan({
        sampelId: sampel.id,
        ke: tujuan,
        pemegangId,
        kreator,
        catatan,
      });
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
      setTujuan(null);
      setCatatan("");
    });
  };

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <MoveRight className="size-4 text-muted-foreground" />
          Catat perpindahan
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Sekarang{" "}
          <span className="font-semibold">
            {LABEL_STATUS_SAMPEL[sampel.status].toLowerCase()}
          </span>{" "}
          — pilih ke mana barangnya berpindah.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 px-5">
        {pilihan.map((ke) => {
          const gaya = GAYA_STATUS_SAMPEL[ke];
          return (
            <button
              key={ke}
              type="button"
              onClick={() => {
                setPesan(null);
                setTujuan(ke);
              }}
              className={cn(
                "tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] leading-[14px] font-semibold",
                gaya.kelas,
              )}
            >
              <ArrowRight className="size-3.5" />
              {LABEL_STATUS_SAMPEL[ke]}
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
              {sampel.kode} →{" "}
              {tujuan ? LABEL_STATUS_SAMPEL[tujuan].toLowerCase() : ""}
            </DialogTitle>
            <DialogDescription>
              Tercatat atas namamu, lengkap dengan waktunya. Riwayat ini tidak
              bisa disunting belakangan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {perlu?.pemegang ? (
              <fieldset className="space-y-1.5">
                <legend className="text-[13px] leading-[18px] font-semibold">
                  Siapa yang memegangnya
                </legend>
                <div className="max-h-52 space-y-1 overflow-y-auto">
                  {anggota.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setPemegangId(a.id)}
                      aria-pressed={pemegangId === a.id}
                      className={cn(
                        "baris-interaktif flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left",
                        pemegangId === a.id
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "bg-muted/50",
                      )}
                    >
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
            ) : null}

            {perlu?.kreator ? (
              <div className="space-y-1.5">
                <label
                  htmlFor="kreator-sampel"
                  className="text-[13px] leading-[18px] font-semibold"
                >
                  Kreator tujuan
                </label>
                <input
                  id="kreator-sampel"
                  value={kreator}
                  maxLength={80}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setKreator(e.target.value)}
                  placeholder="@nama.kreator"
                  className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label
                htmlFor="catatan-perpindahan"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Keterangan{" "}
                {perlu?.catatanWajib ? null : (
                  <span className="font-normal text-muted-foreground">
                    (opsional)
                  </span>
                )}
              </label>
              <input
                id="catatan-perpindahan"
                value={catatan}
                maxLength={200}
                autoComplete="off"
                onChange={(e) => setCatatan(e.target.value)}
                placeholder={
                  perlu?.catatanWajib
                    ? "Bagaimana hilangnya?"
                    : "Mis. diserahkan di kantor"
                }
                className="h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              {perlu?.catatanWajib ? (
                <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  Barang hilang selalu perlu keterangan — tanpa itu jejaknya
                  tidak menolong siapa pun saat ditelusuri kemudian.
                </p>
              ) : null}
            </div>
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
              Catat perpindahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
