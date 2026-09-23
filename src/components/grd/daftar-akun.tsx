"use client";

import { useState, useTransition } from "react";
import { Loader2, Power, Store, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { rupiahRingkas } from "@/lib/format";
import {
  ubahCoLeaderAkun,
  ubahPicAkun,
  ubahStatusAkun,
} from "@/app/actions/akun";
import { DialogPindahUnit } from "@/components/grd/dialog-pindah-unit";
import { PanelLevelAkun } from "@/components/grd/panel-level-akun";
import type { AkunKelola, KandidatPic } from "@/lib/data/akun";

/**
 * Dialog penunjukan PIC.
 *
 * Mengganti PIC memindahkan kewajiban Laporan Harian akun ini, jadi
 * konsekuensinya ditulis apa adanya sebelum disimpan — termasuk berapa
 * akun yang sudah dipegang tiap calon, supaya bebannya terlihat.
 */
function DialogPic({
  akun,
  kandidat,
  buka,
  onBuka,
}: {
  akun: AkunKelola;
  kandidat: KandidatPic[];
  buka: boolean;
  onBuka: (b: boolean) => void;
}) {
  const [pilih, setPilih] = useState<string | null>(akun.picId);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const simpan = () => {
    if (menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await ubahPicAkun({ akunId: akun.id, picId: pilih });
      if (hasil.ok) {
        onBuka(false);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>PIC {akun.username}</DialogTitle>
          <DialogDescription>
            PIC bertanggung jawab mengisi Laporan Harian akun ini. Hanya staf di{" "}
            {akun.unitNama} yang bisa ditunjuk.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {kandidat.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setPilih(k.id)}
              aria-pressed={pilih === k.id}
              className={cn(
                "baris-interaktif flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left",
                pilih === k.id
                  ? "bg-primary/10 ring-1 ring-primary/30"
                  : "bg-muted/50",
              )}
            >
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="bg-card text-[11px] font-semibold text-muted-foreground">
                  {k.inisial}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-[18px] font-semibold">
                  {k.nama}
                </span>
                <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                  {k.jabatan}
                </span>
              </span>
              <span className="shrink-0 text-[11px] leading-[14px] text-muted-foreground">
                {k.jumlahAkun === 0
                  ? "belum pegang akun"
                  : `${k.jumlahAkun} akun`}
              </span>
            </button>
          ))}

          {kandidat.length === 0 ? (
            <p className="rounded-xl bg-muted px-3 py-2 text-[11px] leading-[14px] text-muted-foreground">
              Belum ada staf aktif di unit ini yang bisa ditunjuk.
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setPilih(null)}
          aria-pressed={pilih === null}
          className={cn(
            "tekan-halus rounded-xl px-3 py-2 text-left text-[11px] leading-[14px] font-semibold",
            pilih === null
              ? "bg-warn-fill text-warn-text"
              : "bg-muted text-muted-foreground",
          )}
        >
          Kosongkan PIC — akun sementara tanpa penanggung jawab
        </button>

        {pesan ? (
          <p
            role="status"
            className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text"
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
            disabled={menyimpan || pilih === akun.picId}
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            {menyimpan ? "Menyimpan…" : "Simpan PIC"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dialog penunjukan co-leader.
 *
 * Co-leader ikut melihat akun ini beserta GMV dan laporan hariannya, jadi
 * calonnya hanya pimpinan unit akun tersebut.
 */
function DialogCoLeader({
  akun,
  kandidat,
  buka,
  onBuka,
}: {
  akun: AkunKelola;
  kandidat: KandidatPic[];
  buka: boolean;
  onBuka: (b: boolean) => void;
}) {
  const [pilih, setPilih] = useState<string | null>(akun.coLeaderId);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const simpan = () => {
    if (menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await ubahCoLeaderAkun({
        akunId: akun.id,
        coLeaderId: pilih,
      });
      if (hasil.ok) {
        onBuka(false);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Co-leader {akun.username}</DialogTitle>
          <DialogDescription>
            Co-leader ikut melihat akun ini beserta GMV dan laporan hariannya.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          {kandidat.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setPilih(k.id)}
              aria-pressed={pilih === k.id}
              className={cn(
                "baris-interaktif flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left",
                pilih === k.id
                  ? "bg-primary/10 ring-1 ring-primary/30"
                  : "bg-muted/50",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] font-medium">
                {k.nama}
              </span>
              <span className="shrink-0 text-[11px] leading-[14px] text-muted-foreground">
                {k.jumlahAkun === 0
                  ? "belum mendampingi akun"
                  : `${k.jumlahAkun} akun`}
              </span>
            </button>
          ))}
          {kandidat.length === 0 ? (
            <p className="rounded-xl bg-muted px-3 py-2 text-[11px] leading-[14px] text-muted-foreground">
              Belum ada Leader atau Co-Leader aktif di unit ini.
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setPilih(null)}
          aria-pressed={pilih === null}
          className={cn(
            "tekan-halus rounded-xl px-3 py-2 text-left text-[11px] leading-[14px] font-semibold",
            pilih === null
              ? "bg-warn-fill text-warn-text"
              : "bg-muted text-muted-foreground",
          )}
        >
          Kosongkan co-leader — aksesnya ke akun ini ikut berhenti
        </button>

        {pesan ? (
          <p
            role="status"
            className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text"
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
            disabled={menyimpan || pilih === akun.coLeaderId}
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            {menyimpan ? "Menyimpan…" : "Simpan co-leader"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BarisAkun({
  akun,
  kandidat,
  kandidatCoLeader,
  bolehKelola,
}: {
  akun: AkunKelola;
  kandidat: KandidatPic[];
  kandidatCoLeader: KandidatPic[];
  bolehKelola: boolean;
}) {
  const [bukaPic, setBukaPic] = useState(false);
  const [bukaCoLeader, setBukaCoLeader] = useState(false);
  const [bukaUnit, setBukaUnit] = useState(false);
  const [bukaStatus, setBukaStatus] = useState(false);
  const [mengubah, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const akanNonaktif = akun.status === "aktif";

  const alihkanStatus = () => {
    if (mengubah) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await ubahStatusAkun({
        akunId: akun.id,
        status: akanNonaktif ? "nonaktif" : "aktif",
      });
      if (hasil.ok) {
        setBukaStatus(false);
        return;
      }
      setPesan(hasil.pesan);
      setBukaStatus(false);
    });
  };

  return (
    <li
      className={cn(
        "rounded-2xl bg-muted/50 p-3.5",
        akun.status === "nonaktif" && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-card text-muted-foreground">
          <Store className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm leading-5 font-semibold">
              {akun.username}
            </span>
            {akun.program && akun.program !== "Reguler" ? (
              <span className="rounded-full bg-accentmuted-fill px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-accentmuted-text">
                {akun.program}
              </span>
            ) : null}
            {akun.status === "nonaktif" ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-muted-foreground">
                nonaktif
              </span>
            ) : null}
          </p>
          {bolehKelola ? (
            <button
              type="button"
              onClick={() => setBukaUnit(true)}
              className="tekan-halus truncate text-left text-[11px] leading-[14px] text-muted-foreground underline-offset-2 hover:underline"
            >
              {akun.unitNama} · {akun.platform}
              <span className="sr-only">
                {" "}
                — pindahkan akun ini ke unit lain
              </span>
            </button>
          ) : (
            <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
              {akun.unitNama} · {akun.platform}
            </p>
          )}
          {bolehKelola ? (
            <button
              type="button"
              onClick={() => setBukaCoLeader(true)}
              className="tekan-halus truncate text-left text-[11px] leading-[14px] text-muted-foreground underline-offset-2 hover:underline"
            >
              {akun.coLeaderNama
                ? `Co-Leader ${akun.coLeaderNama}`
                : "Belum ada co-leader"}
            </button>
          ) : akun.coLeaderNama ? (
            <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
              Co-Leader {akun.coLeaderNama}
            </p>
          ) : null}

          <PanelLevelAkun akun={akun} bolehKelola={bolehKelola} />
        </div>

        <span className="tabular shrink-0 text-right">
          <span className="block text-[13px] leading-[18px] font-semibold">
            {rupiahRingkas(akun.gmvPeriode)}
          </span>
          <span className="block text-[11px] leading-[14px] text-muted-foreground">
            GMV periode
          </span>
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {akun.picInisial ? (
            <Avatar className="size-7 shrink-0">
              <AvatarFallback className="bg-card text-[10px] font-semibold text-muted-foreground">
                {akun.picInisial}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-warn-fill text-warn-text">
              <UserRound className="size-3.5" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[13px] leading-[18px] font-medium">
              {akun.picNama ?? "Belum ada PIC"}
            </span>
            <span className="block text-[11px] leading-[14px] text-muted-foreground">
              {akun.picNama
                ? "PIC laporan harian"
                : "laporan harian tak terisi"}
            </span>
          </span>
        </span>

        {bolehKelola ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBukaPic(true)}
              className="tekan-halus sentuh-nyaman h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold"
            >
              Ubah PIC
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setBukaStatus(true)}
              disabled={mengubah}
              aria-label={
                akun.status === "aktif"
                  ? `Nonaktifkan ${akun.username}`
                  : `Aktifkan ${akun.username}`
              }
              className="tekan-halus sentuh-nyaman size-8 shrink-0 rounded-full p-0"
            >
              {mengubah ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Power className="size-3.5" />
              )}
            </Button>
          </>
        ) : null}
      </div>

      {pesan ? (
        <p
          role="status"
          className="mt-2 rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text"
        >
          {pesan}
        </p>
      ) : null}

      {bolehKelola ? (
        <>
          <DialogPic
            akun={akun}
            kandidat={kandidat}
            buka={bukaPic}
            onBuka={setBukaPic}
          />

          <DialogCoLeader
            akun={akun}
            kandidat={kandidatCoLeader}
            buka={bukaCoLeader}
            onBuka={setBukaCoLeader}
          />

          <DialogPindahUnit akun={akun} buka={bukaUnit} onBuka={setBukaUnit} />

          <Dialog open={bukaStatus} onOpenChange={setBukaStatus}>
            <DialogContent className="rounded-3xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {akanNonaktif ? "Nonaktifkan" : "Aktifkan"} {akun.username}?
                </DialogTitle>
                <DialogDescription>
                  {akanNonaktif
                    ? "Akun berhenti menagih Laporan Harian dan tidak lagi masuk hitungan target. Riwayat GMV-nya tetap tersimpan dan akun bisa diaktifkan lagi kapan saja."
                    : "Akun kembali menagih Laporan Harian dari PIC-nya dan ikut dihitung ke target unit."}
                </DialogDescription>
              </DialogHeader>

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
                  disabled={mengubah}
                  onClick={alihkanStatus}
                  className="tekan-halus rounded-full"
                >
                  {mengubah ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {akanNonaktif ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </li>
  );
}

/** Daftar akun affiliator beserta PIC-nya. */
export function DaftarAkun({
  daftar,
  kandidat,
  kandidatCoLeader,
  bolehKelola,
}: {
  daftar: AkunKelola[];
  kandidat: KandidatPic[];
  kandidatCoLeader: KandidatPic[];
  bolehKelola: boolean;
}) {
  const tanpaPic = daftar.filter(
    (a) => a.status === "aktif" && !a.picNama,
  ).length;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Akun &amp; PIC</h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          {daftar.length} akun terdaftar
          {tanpaPic > 0 ? ` · ${tanpaPic} belum punya PIC` : ""}
        </p>
      </div>

      {daftar.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada akun yang terlihat untukmu.
        </p>
      ) : (
        <ul className="space-y-2 px-5">
          {daftar.map((a) => (
            <BarisAkun
              key={a.id}
              akun={a}
              kandidat={kandidat}
              kandidatCoLeader={kandidatCoLeader}
              bolehKelola={bolehKelola}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
