"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Loader2, UserRoundCheck } from "lucide-react";
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
  BUTUH_CATATAN,
  GAYA_STATUS_ASET,
  LABEL_STATUS_ASET,
  periksaPerpindahanAset,
  tujuanPerpindahan,
  type Aset,
  type StatusAset,
} from "@/lib/aset";
import { catatPerpindahanAset } from "@/app/actions/aset";
import type { Pengguna } from "@/lib/types";

/**
 * Ganti pemegang aset, dengan catatan.
 *
 * Hanya keadaan yang memang mungkin dari keadaan sekarang yang
 * ditawarkan, dan pemeriksaan yang sama dipakai untuk mematikan tombol
 * simpan — supaya penolakan terbaca sebelum ditekan, bukan sesudah.
 */
export function AksiPemegang({
  aset,
  anggota,
}: {
  aset: Aset;
  anggota: Pick<Pengguna, "id" | "nama" | "jabatan">[];
}) {
  const [tujuan, setTujuan] = useState<StatusAset | null>(null);
  const [pemegangId, setPemegangId] = useState<string | null>(aset.pemegangId);
  const [lokasi, setLokasi] = useState(aset.lokasi);
  const [catatan, setCatatan] = useState("");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  const pilihan = tujuanPerpindahan(aset.status);
  const salah =
    tujuan === null
      ? "Pilih keadaan tujuannya."
      : periksaPerpindahanAset(
          { asetId: aset.id, ke: tujuan, pemegangId, lokasi, catatan },
          aset,
        );

  const simpan = () => {
    if (!tujuan || salah || menyimpan) return;
    mulai(async () => {
      setPesan(null);
      const hasil = await catatPerpindahanAset({
        asetId: aset.id,
        ke: tujuan,
        pemegangId,
        lokasi,
        catatan,
      });
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
      setTujuan(null);
      setCatatan("");
    });
  };

  if (pilihan.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Aset ini sudah dilepas, jadi tidak ada lagi perpindahan yang bisa
          dicatat. Barang yang kembali dicatat sebagai perolehan baru.
        </p>
      </Card>
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <UserRoundCheck className="size-4 text-muted-foreground" />
          Ganti pemegang
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Sekarang{" "}
          <span className="font-semibold">
            {LABEL_STATUS_ASET[aset.status].toLowerCase()}
          </span>
          {aset.pemegangNama
            ? ` di tangan ${aset.pemegangNama}`
            : ", tanpa pemegang"}{" "}
          — pilih keadaan setelah perpindahan ini.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 px-5">
        {pilihan.map((ke) => {
          const gaya = GAYA_STATUS_ASET[ke];
          return (
            <button
              key={ke}
              type="button"
              onClick={() => {
                setPesan(null);
                setPemegangId(aset.pemegangId);
                setLokasi(aset.lokasi);
                setTujuan(ke);
              }}
              className={cn(
                "tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] leading-[14px] font-semibold",
                gaya.kelas,
              )}
            >
              <ArrowRight className="size-3.5" />
              {ke === aset.status ? "Pindah tangan" : LABEL_STATUS_ASET[ke]}
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
              {aset.kode} →{" "}
              {tujuan
                ? tujuan === aset.status
                  ? "pindah tangan"
                  : LABEL_STATUS_ASET[tujuan].toLowerCase()
                : ""}
            </DialogTitle>
            <DialogDescription>
              Tercatat atas namamu beserta waktunya. Riwayat aset tidak bisa
              disunting belakangan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] leading-[18px] font-semibold">
                Pemegang setelah perpindahan
              </legend>
              <div className="max-h-52 space-y-1 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setPemegangId(null)}
                  aria-pressed={pemegangId === null}
                  className={cn(
                    "baris-interaktif flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left",
                    pemegangId === null
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "bg-muted/50",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] leading-[18px] font-semibold">
                      Tanpa pemegang
                    </span>
                    <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                      Barang bersama atau disimpan di gudang
                    </span>
                  </span>
                </button>

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

            <div className="space-y-1.5">
              <label
                htmlFor="lokasi-aset"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Lokasi barang
              </label>
              <input
                id="lokasi-aset"
                value={lokasi}
                maxLength={60}
                autoComplete="off"
                onChange={(e) => setLokasi(e.target.value)}
                placeholder="Mis. Studio MCN Lt. 2"
                className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="catatan-aset"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Keterangan{" "}
                {tujuan && BUTUH_CATATAN.includes(tujuan) ? null : (
                  <span className="font-normal text-muted-foreground">
                    (opsional)
                  </span>
                )}
              </label>
              <input
                id="catatan-aset"
                value={catatan}
                maxLength={200}
                autoComplete="off"
                onChange={(e) => setCatatan(e.target.value)}
                placeholder={
                  tujuan === "hilang"
                    ? "Bagaimana hilangnya?"
                    : tujuan === "dilepas"
                      ? "Dilepas ke mana, dan mengapa?"
                      : "Mis. serah terima saat pindah unit"
                }
                className="h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              {tujuan && BUTUH_CATATAN.includes(tujuan) ? (
                <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  Barang yang hilang atau dilepas selalu perlu keterangan —
                  nilainya ikut berhenti di sana, dan itu harus bisa
                  dipertanggungjawabkan.
                </p>
              ) : null}
            </div>

            {salah && tujuan ? (
              <p className="rounded-2xl bg-warn-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-warn-text">
                {salah}
              </p>
            ) : null}
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
              disabled={Boolean(salah) || menyimpan}
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
