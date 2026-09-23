"use client";

import { useState, useTransition } from "react";
import { ArrowRight, History, PencilLine } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputGmv } from "@/components/laporan-harian/input-gmv";
import { cn } from "@/lib/utils";
import { jamWib, rupiahPenuh, tanggalPendek } from "@/lib/format";
import { RincianRevisi } from "@/components/laporan-harian/rincian-revisi";
import {
  bersihkanIsi,
  MAKS_KOMISI,
  MAKS_UPLOAD,
  periksaIsiLaporan,
  punyaKolom,
} from "@/lib/laporan";
import { perbaikiLaporan } from "@/app/actions/laporan";
import type { LaporanHarian, RevisiLaporan } from "@/lib/types";

const MIN_ALASAN = 10;

/**
 * Perbaikan laporan yang berjejak (PRD §3): angka lama, angka baru, dan
 * alasannya dicatat sebagai baris `daily_report_revisions` — laporan tidak
 * pernah diubah diam-diam.
 */
export function DialogRevisi({
  laporan,
  jejak,
  olehNama,
  onSimpan,
}: {
  laporan: LaporanHarian;
  jejak: RevisiLaporan[];
  olehNama: string;
  onSimpan: (revisi: RevisiLaporan) => void;
}) {
  const unit = laporan.departemen;
  const [buka, setBuka] = useState(false);
  const [gmvBaru, setGmvBaru] = useState(laporan.gmv);
  const [komisiBaru, setKomisiBaru] = useState(laporan.komisi ?? 0);
  const [uploadBaru, setUploadBaru] = useState(laporan.jumlahUpload ?? 0);
  const [alasan, setAlasan] = useState("");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const isiBaru = bersihkanIsi(unit, {
    gmv: gmvBaru,
    komisi: komisiBaru,
    jumlahUpload: uploadBaru,
    catatan: laporan.catatan,
  });
  // Perbaikan boleh menyentuh angka mana pun; yang wajib hanya ada yang
  // benar-benar berubah, dan alasannya.
  const berubah =
    isiBaru.gmv !== laporan.gmv ||
    isiBaru.komisi !== (laporan.komisi ?? null) ||
    isiBaru.jumlahUpload !== (laporan.jumlahUpload ?? null);
  const salah = periksaIsiLaporan(unit, isiBaru);
  const alasanCukup = alasan.trim().length >= MIN_ALASAN;
  const bisaSimpan = berubah && !salah && alasanCukup;
  const selisih = gmvBaru - laporan.gmv;

  const simpan = () => {
    if (!bisaSimpan || menyimpan) return;
    setPesan(null);

    mulai(async () => {
      const hasil = await perbaikiLaporan({
        reportId: laporan.id,
        gmv: isiBaru.gmv,
        komisi: isiBaru.komisi,
        jumlahUpload: isiBaru.jumlahUpload,
        alasan: alasan.trim(),
      });

      // Di mode demo alurnya tetap diperlihatkan; datanya tidak tersimpan.
      if (!hasil.ok && hasil.kode !== "demo") {
        setPesan(hasil.pesan);
        return;
      }

      const ubahKomisi = isiBaru.komisi !== (laporan.komisi ?? null);
      const ubahUpload =
        isiBaru.jumlahUpload !== (laporan.jumlahUpload ?? null);
      onSimpan({
        id: `rev-${Date.now()}`,
        reportId: laporan.id,
        gmvLama: laporan.gmv,
        gmvBaru: isiBaru.gmv,
        komisiLama: ubahKomisi ? (laporan.komisi ?? 0) : null,
        komisiBaru: ubahKomisi ? isiBaru.komisi : null,
        uploadLama: ubahUpload ? (laporan.jumlahUpload ?? 0) : null,
        uploadBaru: ubahUpload ? isiBaru.jumlahUpload : null,
        alasan: alasan.trim(),
        diubahOleh: olehNama,
        createdAt: new Date().toISOString(),
      });
      setAlasan("");
      setBuka(false);
    });
  };

  return (
    <Dialog
      open={buka}
      onOpenChange={(v) => {
        setBuka(v);
        if (v) {
          setGmvBaru(laporan.gmv);
          setKomisiBaru(laporan.komisi ?? 0);
          setUploadBaru(laporan.jumlahUpload ?? 0);
          setAlasan("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="tekan-halus sentuh-nyaman h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold"
        >
          <PencilLine className="size-3" />
          Perbaiki
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Perbaiki laporan</DialogTitle>
          <DialogDescription>
            {laporan.label} · {tanggalPendek(laporan.tanggal)}. Setiap angka
            yang berubah selalu meninggalkan jejak.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                Angka sekarang
              </p>
              <p className="tabular truncate text-sm leading-5 font-semibold">
                {rupiahPenuh(laporan.gmv)}
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                Angka baru
              </p>
              <p
                className={cn(
                  "tabular truncate text-sm leading-5 font-semibold",
                  berubah
                    ? selisih > 0
                      ? "text-ok-text"
                      : "text-danger-text"
                    : "text-muted-foreground",
                )}
              >
                {gmvBaru > 0 ? rupiahPenuh(gmvBaru) : "—"}
                {berubah ? (
                  <span className="ml-1 text-[11px] leading-[14px]">
                    ({selisih > 0 ? "+" : "−"}
                    {rupiahPenuh(Math.abs(selisih))})
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="gmv-revisi"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Nilai GMV yang benar
            </label>
            <InputGmv id="gmv-revisi" nilai={gmvBaru} onUbah={setGmvBaru} />
          </div>

          {punyaKolom(unit, "komisi") || punyaKolom(unit, "jumlahUpload") ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {punyaKolom(unit, "komisi") ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="komisi-revisi"
                    className="text-[13px] leading-[18px] font-semibold"
                  >
                    Komisi diterima
                  </label>
                  <InputGmv
                    id="komisi-revisi"
                    ringkas
                    label="komisi"
                    maks={MAKS_KOMISI}
                    nilai={komisiBaru}
                    onUbah={setKomisiBaru}
                  />
                </div>
              ) : null}

              {punyaKolom(unit, "jumlahUpload") ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="upload-revisi"
                    className="text-[13px] leading-[18px] font-semibold"
                  >
                    Jumlah upload
                  </label>
                  <InputGmv
                    id="upload-revisi"
                    ringkas
                    label="jumlah upload"
                    prefix="×"
                    maks={MAKS_UPLOAD}
                    nilai={uploadBaru}
                    onUbah={setUploadBaru}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {salah ? (
            <p className="text-[11px] leading-[14px] font-semibold text-warn-text">
              {salah}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <label
              htmlFor="alasan"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Alasan perbaikan
            </label>
            <textarea
              id="alasan"
              rows={3}
              maxLength={300}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Mis. ada pesanan masuk setelah cutoff yang belum terhitung."
              className="w-full resize-none rounded-xl bg-muted px-4 py-3 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <p
              className={cn(
                "text-[11px] leading-[14px]",
                alasan.length > 0 && !alasanCukup
                  ? "font-semibold text-warn-text"
                  : "text-muted-foreground",
              )}
            >
              {alasan.length > 0 && !alasanCukup
                ? `Tulis minimal ${MIN_ALASAN} karakter supaya jejaknya berguna.`
                : "Alasan wajib diisi dan ikut tercatat di jejak revisi."}
            </p>
          </div>

          {jejak.length > 0 ? (
            <div className="space-y-2 border-t border-border-subtle pt-3">
              <p className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold">
                <History className="size-3.5 text-muted-foreground" />
                Jejak revisi ({jejak.length})
              </p>
              <ul className="space-y-2">
                {jejak.map((r) => (
                  <li key={r.id} className="rounded-xl bg-muted/60 px-3 py-2.5">
                    <RincianRevisi revisi={r} className="text-[11px]" />
                    <p className="mt-0.5 text-[11px] leading-[14px] text-muted-foreground">
                      {r.alasan}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-[14px] text-muted-foreground">
                      {r.diubahOleh} · {tanggalPendek(r.createdAt)}{" "}
                      {jamWib(r.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {pesan ? (
          <p
            role="status"
            className="rounded-xl bg-danger-fill px-4 py-2.5 text-[13px] leading-[18px] text-danger-text"
          >
            {pesan}
          </p>
        ) : null}

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
            disabled={!bisaSimpan || menyimpan}
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? "Menyimpan…" : "Simpan perbaikan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
