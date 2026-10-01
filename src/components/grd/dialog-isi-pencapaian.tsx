"use client";

import { useState, useTransition } from "react";
import { Loader2, PencilLine } from "lucide-react";
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
import { TandaPredikat } from "@/components/grd/lencana-predikat";
import { cn } from "@/lib/utils";
import { angka, bacaAngka } from "@/lib/format";
import {
  hitungLembarKpi,
  nilaiTangga,
  tampilAngkaKpi,
  type RincianGrd,
} from "@/lib/kpi";
import { isiPencapaianKpi } from "@/app/actions/kpi";

/** Teks awal kotak isian: angka tersimpan dalam tulisan Indonesia. */
const keTeks = (nilai: number | null) =>
  nilai === null ? "" : angka(nilai, 6);

/**
 * Penilai mengisi PENCAPAIAN lembar KPI GRD seseorang.
 *
 * Setiap kotak langsung menunjukkan bagaimana isiannya dibaca dan VALUE
 * yang dihasilkannya, dan kaki dialog menunjukkan NILAI KPI-nya — supaya
 * penilai melihat akibat angkanya sebelum disimpan, sama seperti kolom
 * VALUE dan NILAI di file GRD. Kotak yang dikosongkan bernilai 0.
 */
export function DialogIsiPencapaian({
  userId,
  nama,
  bulan,
  bulanLabel,
  rincian,
}: {
  userId: string;
  nama: string;
  bulan: string;
  bulanLabel: string;
  rincian: RincianGrd[];
}) {
  const [buka, setBuka] = useState(false);
  const [teks, setTeks] = useState<Record<string, string>>({});
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const bukaDialog = (b: boolean) => {
    // Selalu mulai dari angka tersimpan, bukan sisa ketikan sebelumnya.
    if (b) {
      setTeks(
        Object.fromEntries(
          rincian.map((r) => [r.indikatorId, keTeks(r.pencapaian)]),
        ),
      );
      setPesan(null);
    }
    setBuka(b);
  };

  const baris = rincian.map((r) => {
    const dibaca = bacaAngka(teks[r.indikatorId] ?? "");
    const salah = dibaca !== null && Number.isNaN(dibaca);
    const pencapaian = salah ? null : dibaca;
    return {
      r,
      salah,
      pencapaian,
      nilai: nilaiTangga(pencapaian, r.tangga, r.arah),
      berubah: !salah && pencapaian !== r.pencapaian,
    };
  });

  const ringkas = hitungLembarKpi(
    baris.map((b) => ({ ...b.r, pencapaian: b.pencapaian })),
  );
  const adaSalah = baris.some((b) => b.salah);
  const berubah = baris.filter((b) => b.berubah);
  const siap = !adaSalah && berubah.length > 0;

  const simpan = () => {
    if (!siap || menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await isiPencapaianKpi({
        userId,
        bulan,
        isian: berubah.map((b) => ({
          indikatorId: b.r.indikatorId,
          nilai: b.pencapaian,
        })),
      });
      if (hasil.ok) {
        setBuka(false);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={bukaDialog}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <PencilLine className="size-3.5" />
          Isi pencapaian
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pencapaian KPI {nama}</DialogTitle>
          <DialogDescription>
            {bulanLabel} · VALUE = banyak kolom tangga yang terlampaui. Kotak
            yang kosong bernilai 0.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          {baris.map(({ r, salah, pencapaian, nilai }) => {
            const id = `pencapaian-${r.indikatorId}`;
            return (
              <li key={r.indikatorId} className="space-y-1.5">
                <label
                  htmlFor={id}
                  className="block text-[13px] leading-[18px] font-semibold"
                >
                  {r.urutan}. {r.nama}
                </label>
                <p className="text-[11px] leading-[14px] text-muted-foreground">
                  Bobot {r.bobot} · base {tampilAngkaKpi(r.tangga[3], r.satuan)}{" "}
                  · goal {tampilAngkaKpi(r.tangga[7], r.satuan)} · stretch{" "}
                  {tampilAngkaKpi(r.tangga[9], r.satuan)}
                  {r.arah === "turun" ? " · makin kecil makin baik" : ""}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    id={id}
                    inputMode="decimal"
                    autoComplete="off"
                    value={teks[r.indikatorId] ?? ""}
                    onChange={(e) =>
                      setTeks((t) => ({
                        ...t,
                        [r.indikatorId]: e.target.value,
                      }))
                    }
                    placeholder="kosong"
                    aria-invalid={salah || undefined}
                    aria-describedby={`${id}-baca`}
                    className={cn(
                      "tabular h-11 min-w-0 flex-1 rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40",
                      salah && "ring-2 ring-danger/60",
                    )}
                  />
                  <span className="w-16 shrink-0 text-[11px] leading-[14px] text-muted-foreground">
                    {r.satuan}
                  </span>
                </div>
                <p
                  id={`${id}-baca`}
                  className={cn(
                    "tabular text-[11px] leading-[14px]",
                    salah ? "text-danger-text" : "text-muted-foreground",
                  )}
                >
                  {salah
                    ? "Tidak terbaca. Pakai koma untuk desimal, mis. 92,5."
                    : pencapaian === null
                      ? `Kosong → VALUE 0 · total 0`
                      : `Dibaca ${tampilAngkaKpi(pencapaian, r.satuan)} → VALUE ${nilai} · total ${nilai * r.bobot}`}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3">
          <span className="text-[13px] leading-[18px] font-semibold">
            NILAI KPI
          </span>
          <span className="text-right">
            <span className="tabular block text-xl leading-7 font-bold tracking-tight">
              {ringkas.total.toLocaleString("id-ID")}
            </span>
            <TandaPredikat predikat={ringkas.predikat} />
          </span>
        </div>

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
            disabled={!siap || menyimpan}
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            {menyimpan
              ? "Menyimpan…"
              : berubah.length > 0
                ? `Simpan ${berubah.length} pencapaian`
                : "Belum ada perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
