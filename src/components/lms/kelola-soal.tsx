"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { hapusSoal, tambahSoal, ubahSoal } from "@/app/actions/lms";
import type { SoalDenganKunci } from "@/lib/lms";

const MAKS_PILIHAN = 6;

/**
 * Menyusun soal kuis.
 *
 * Kunci jawaban hanya muncul di layar ini dan tidak pernah ikut ke
 * halaman pengerjaan — ia dibaca dari tabel terpisah yang tertutup bagi
 * peserta (migrasi 0056).
 */
export function KelolaSoal({
  kursusId,
  modulId,
  daftar,
}: {
  kursusId: string;
  modulId: string;
  daftar: SoalDenganKunci[];
}) {
  const [sunting, setSunting] = useState<SoalDenganKunci | null>(null);
  const [bukaTambah, setBukaTambah] = useState(false);
  const [hapus, setHapus] = useState<SoalDenganKunci | null>(null);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  const jalankan = (aksi: () => Promise<{ ok: boolean; pesan?: string }>) =>
    mulai(async () => {
      setPesan(null);
      const hasil = await aksi();
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
      if (hasil.ok || hasil.pesan?.startsWith("Mode demo")) {
        setSunting(null);
        setBukaTambah(false);
        setHapus(null);
      }
    });

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="text-base leading-6 font-semibold">Susun soal kuis</h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Kunci jawaban hanya terlihat di layar ini; halaman pengerjaan tidak
            pernah menerimanya.
          </p>
        </div>

        <Button
          type="button"
          disabled={menyimpan}
          onClick={() => setBukaTambah(true)}
          className="tekan-halus sentuh-nyaman h-9 shrink-0 rounded-full px-4 text-[11px] font-semibold"
        >
          <Plus className="size-3.5" />
          Tambah soal
        </Button>
      </div>

      <ol className="space-y-2 px-5">
        {daftar.map((s) => (
          <li key={s.id} className="rounded-2xl bg-muted/50 p-3">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-[13px] leading-[18px] font-medium text-pretty">
                {s.urutan}. {s.pertanyaan}
              </p>
              <Button
                type="button"
                variant="ghost"
                aria-label={`Ubah soal ${s.urutan}`}
                onClick={() => setSunting(s)}
                className="tekan-halus sentuh-nyaman size-8 shrink-0 rounded-full p-0"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-label={`Hapus soal ${s.urutan}`}
                onClick={() => setHapus(s)}
                className="tekan-halus sentuh-nyaman size-8 shrink-0 rounded-full p-0"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            <ul className="mt-1.5 space-y-0.5">
              {s.pilihan.map((p, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] leading-[16px]",
                    i === s.jawabanBenar
                      ? "font-semibold text-ok-text"
                      : "text-muted-foreground",
                  )}
                >
                  {i === s.jawabanBenar ? (
                    <Check className="size-3 shrink-0" />
                  ) : (
                    <span className="w-3 shrink-0" />
                  )}
                  {String.fromCharCode(65 + i)}. {p}
                </li>
              ))}
            </ul>

            {s.penjelasan ? (
              <p className="mt-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                {s.penjelasan}
              </p>
            ) : null}
          </li>
        ))}

        {daftar.length === 0 ? (
          <li className="text-[13px] leading-[18px] text-muted-foreground">
            Belum ada soal. Modul tanpa soal tetap bisa ditandai tuntas manual.
          </li>
        ) : null}
      </ol>

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

      <DialogSoal
        awal={sunting}
        buka={bukaTambah || sunting !== null}
        onBuka={(b) => {
          if (!b) {
            setBukaTambah(false);
            setSunting(null);
          }
        }}
        menyimpan={menyimpan}
        onSimpan={(soal) =>
          jalankan(() =>
            sunting
              ? ubahSoal({ kursusId, soalId: sunting.id, soal })
              : tambahSoal({ kursusId, modulId, soal }),
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
            <DialogTitle>Hapus soal {hapus?.urutan}?</DialogTitle>
            <DialogDescription>
              Skor percobaan yang sudah terjadi tetap tersimpan apa adanya —
              menghitung ulang skor lama dengan soal yang berbeda akan membuat
              riwayatnya berbohong.
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
                jalankan(() => hapusSoal({ kursusId, soalId: hapus.id }))
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

function DialogSoal({
  awal,
  buka,
  onBuka,
  menyimpan,
  onSimpan,
}: {
  awal: SoalDenganKunci | null;
  buka: boolean;
  onBuka: (b: boolean) => void;
  menyimpan: boolean;
  onSimpan: (soal: {
    pertanyaan: string;
    pilihan: string[];
    jawabanBenar: number;
    penjelasan: string;
  }) => void;
}) {
  const [pertanyaan, setPertanyaan] = useState(awal?.pertanyaan ?? "");
  const [pilihan, setPilihan] = useState<string[]>(
    awal?.pilihan ?? ["", "", "", ""],
  );
  const [benar, setBenar] = useState(awal?.jawabanBenar ?? 0);
  const [penjelasan, setPenjelasan] = useState(awal?.penjelasan ?? "");
  const [kunci, setKunci] = useState(awal?.id ?? null);

  if (kunci !== (awal?.id ?? null)) {
    setKunci(awal?.id ?? null);
    setPertanyaan(awal?.pertanyaan ?? "");
    setPilihan(awal?.pilihan ?? ["", "", "", ""]);
    setBenar(awal?.jawabanBenar ?? 0);
    setPenjelasan(awal?.penjelasan ?? "");
  }

  const terisi = pilihan.map((p) => p.trim()).filter(Boolean);
  const siap =
    pertanyaan.trim().length >= 5 &&
    terisi.length >= 2 &&
    benar < pilihan.length &&
    pilihan[benar]?.trim() !== "";

  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{awal ? "Ubah soal" : "Tambah soal"}</DialogTitle>
          <DialogDescription>
            Tandai satu pilihan sebagai jawaban benar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="pertanyaan-soal"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Pertanyaan
            </label>
            <textarea
              id="pertanyaan-soal"
              value={pertanyaan}
              maxLength={400}
              rows={2}
              onChange={(e) => setPertanyaan(e.target.value)}
              placeholder="Tanyakan hal yang benar-benar dipakai sehari-hari."
              className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Pilihan jawaban
            </legend>
            {pilihan.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBenar(i)}
                  aria-pressed={benar === i}
                  aria-label={`Tandai pilihan ${String.fromCharCode(65 + i)} sebagai benar`}
                  className={cn(
                    "tekan-halus flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    benar === i
                      ? "bg-ok text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {benar === i ? (
                    <Check className="size-3.5" />
                  ) : (
                    String.fromCharCode(65 + i)
                  )}
                </button>
                <input
                  value={p}
                  maxLength={160}
                  autoComplete="off"
                  aria-label={`Pilihan ${String.fromCharCode(65 + i)}`}
                  onChange={(e) =>
                    setPilihan((s) =>
                      s.map((x, j) => (j === i ? e.target.value : x)),
                    )
                  }
                  className="h-11 min-w-0 flex-1 rounded-xl bg-muted px-4 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
                {pilihan.length > 2 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Hapus pilihan ${String.fromCharCode(65 + i)}`}
                    onClick={() => {
                      setPilihan((s) => s.filter((_, j) => j !== i));
                      if (benar >= pilihan.length - 1) setBenar(0);
                    }}
                    className="tekan-halus size-8 shrink-0 rounded-full p-0"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}

            {pilihan.length < MAKS_PILIHAN ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setPilihan((s) => [...s, ""])}
                className="tekan-halus h-9 rounded-full px-3 text-[11px] font-semibold"
              >
                <Plus className="size-3.5" />
                Tambah pilihan
              </Button>
            ) : null}
          </fieldset>

          <div className="space-y-1.5">
            <label
              htmlFor="penjelasan-soal"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Penjelasan{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </label>
            <input
              id="penjelasan-soal"
              value={penjelasan}
              maxLength={300}
              autoComplete="off"
              onChange={(e) => setPenjelasan(e.target.value)}
              placeholder="Mengapa jawaban itu yang benar"
              className="h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
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
            onClick={() =>
              onSimpan({ pertanyaan, pilihan, jawabanBenar: benar, penjelasan })
            }
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            Simpan soal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
