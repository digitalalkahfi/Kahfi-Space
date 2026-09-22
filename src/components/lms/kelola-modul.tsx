"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
import {
  hapusModul,
  pindahModul,
  tambahModul,
  ubahModul,
} from "@/app/actions/lms";
import type { Kursus, ModulKursus } from "@/lib/lms";

/**
 * Menyusun modul kursus.
 *
 * Modul baru selalu masuk di urutan terakhir, dan menghapus satu modul
 * merapatkan nomor sisanya (migrasi 0055) — nomor yang berlubang membuat
 * peserta mengira ada materi yang hilang.
 */
export function KelolaModul({ kursus }: { kursus: Kursus }) {
  const [sunting, setSunting] = useState<ModulKursus | null>(null);
  const [bukaTambah, setBukaTambah] = useState(false);
  const [hapus, setHapus] = useState<ModulKursus | null>(null);
  const [menyimpan, mulai] = useTransition();
  const [memindah, mulaiPindah] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const pindah = (modulId: string, arah: "naik" | "turun") =>
    mulaiPindah(async () => {
      setPesan(null);
      const hasil = await pindahModul({
        kursusId: kursus.id,
        modulId,
        arah,
      });
      if (!hasil.ok) setPesan(hasil.pesan ?? null);
    });
  const [berhasil, setBerhasil] = useState(false);

  const jalankan = (aksi: () => Promise<{ ok: boolean; pesan?: string }>) =>
    mulai(async () => {
      setPesan(null);
      const hasil = await aksi();
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
      setSunting(null);
      setBukaTambah(false);
      setHapus(null);
    });

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="text-base leading-6 font-semibold">Susun modul</h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Menambah modul membuat peserta yang sudah lulus kembali berstatus
            berjalan sampai modul barunya mereka tuntaskan.
          </p>
        </div>

        <Button
          type="button"
          disabled={menyimpan}
          onClick={() => setBukaTambah(true)}
          className="tekan-halus sentuh-nyaman h-9 shrink-0 rounded-full px-4 text-[11px] font-semibold"
        >
          <Plus className="size-3.5" />
          Tambah modul
        </Button>
      </div>

      <ul className="space-y-1.5 px-5">
        {kursus.modul.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] leading-[18px] font-medium">
                {m.urutan}. {m.judul}
              </span>
              <span className="block text-[11px] leading-[14px] text-muted-foreground">
                {m.durasiMenit} menit
                {m.isi
                  ? ` · ${m.isi.length} huruf materi`
                  : " · belum ada materi"}
              </span>
            </span>

            <Button
              type="button"
              variant="ghost"
              disabled={m.urutan === 1 || memindah}
              aria-label={`Naikkan modul ${m.judul}`}
              onClick={() => pindah(m.id, "naik")}
              className="tekan-halus sentuh-nyaman size-8 shrink-0 rounded-full p-0"
            >
              <ChevronUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={m.urutan === kursus.modul.length || memindah}
              aria-label={`Turunkan modul ${m.judul}`}
              onClick={() => pindah(m.id, "turun")}
              className="tekan-halus sentuh-nyaman size-8 shrink-0 rounded-full p-0"
            >
              <ChevronDown className="size-3.5" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              aria-label={`Ubah modul ${m.judul}`}
              onClick={() => setSunting(m)}
              className="tekan-halus sentuh-nyaman size-8 shrink-0 rounded-full p-0"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-label={`Hapus modul ${m.judul}`}
              onClick={() => setHapus(m)}
              className="tekan-halus sentuh-nyaman size-8 shrink-0 rounded-full p-0"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}

        {kursus.modul.length === 0 ? (
          <li className="text-[13px] leading-[18px] text-muted-foreground">
            Belum ada modul. Kursus tanpa modul tidak bisa diselesaikan siapa
            pun.
          </li>
        ) : null}
      </ul>

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

      <DialogModul
        judulDialog={sunting ? "Ubah modul" : "Tambah modul"}
        awal={sunting}
        buka={bukaTambah || sunting !== null}
        onBuka={(b) => {
          if (!b) {
            setBukaTambah(false);
            setSunting(null);
          }
        }}
        menyimpan={menyimpan}
        onSimpan={(data) =>
          jalankan(() =>
            sunting
              ? ubahModul({
                  kursusId: kursus.id,
                  modulId: sunting.id,
                  ...data,
                })
              : tambahModul({ kursusId: kursus.id, ...data }),
          )
        }
      />

      <Dialog
        open={hapus !== null}
        onOpenChange={(b) => {
          if (!b) setHapus(null);
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus modul {hapus?.judul}?</DialogTitle>
            <DialogDescription>
              Kemajuan peserta pada modul ini ikut terhapus, dan nomor modul
              sisanya dirapatkan. Materinya tidak bisa dikembalikan.
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
              disabled={menyimpan}
              onClick={() =>
                hapus &&
                jalankan(() =>
                  hapusModul({ kursusId: kursus.id, modulId: hapus.id }),
                )
              }
              className="tekan-halus rounded-full"
            >
              {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DialogModul({
  judulDialog,
  awal,
  buka,
  onBuka,
  menyimpan,
  onSimpan,
}: {
  judulDialog: string;
  awal: ModulKursus | null;
  buka: boolean;
  onBuka: (b: boolean) => void;
  menyimpan: boolean;
  onSimpan: (data: { judul: string; isi: string; durasiMenit: number }) => void;
}) {
  const [judul, setJudul] = useState(awal?.judul ?? "");
  const [isi, setIsi] = useState(awal?.isi ?? "");
  const [durasi, setDurasi] = useState(String(awal?.durasiMenit ?? 10));
  const [kunci, setKunci] = useState(awal?.id ?? null);

  // Menyelaraskan isian saat modul yang disunting berganti.
  if (kunci !== (awal?.id ?? null)) {
    setKunci(awal?.id ?? null);
    setJudul(awal?.judul ?? "");
    setIsi(awal?.isi ?? "");
    setDurasi(String(awal?.durasiMenit ?? 10));
  }

  const menit = Number(durasi);
  const siap =
    judul.trim().length >= 3 &&
    Number.isFinite(menit) &&
    menit >= 1 &&
    menit <= 600;

  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{judulDialog}</DialogTitle>
          <DialogDescription>
            Satu modul sebaiknya selesai dalam sekali duduk.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="judul-modul"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Judul modul
            </label>
            <input
              id="judul-modul"
              value={judul}
              maxLength={140}
              autoComplete="off"
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Mis. Menyiapkan alat & pencahayaan"
              className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="durasi-modul"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Perkiraan durasi (menit)
            </label>
            <input
              id="durasi-modul"
              inputMode="numeric"
              value={durasi}
              maxLength={3}
              onChange={(e) => setDurasi(e.target.value.replace(/\D/g, ""))}
              className="tabular h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="isi-modul"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Materi
            </label>
            <textarea
              id="isi-modul"
              value={isi}
              maxLength={6000}
              rows={8}
              onChange={(e) => setIsi(e.target.value)}
              placeholder="Pisahkan paragraf dengan satu baris kosong."
              className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] leading-[20px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              Satu baris kosong memisahkan paragraf di halaman baca.
            </p>
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
            onClick={() => onSimpan({ judul, isi, durasiMenit: menit })}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            Simpan modul
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
