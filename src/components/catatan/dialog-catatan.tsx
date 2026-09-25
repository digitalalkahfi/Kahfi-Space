"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  ARTI_VISIBILITAS,
  KATEGORI_CATATAN_SAH,
  LABEL_KATEGORI_CATATAN,
  LABEL_VISIBILITAS,
  VISIBILITAS_CATATAN_SAH,
  type Catatan,
  type KategoriCatatan,
  type VisibilitasCatatan,
} from "@/lib/catatan";
import {
  tambahCatatan,
  ubahCatatan,
  type MasukanCatatan,
} from "@/app/actions/catatan";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

const KELAS_LABEL = "text-[13px] leading-[18px] font-semibold";
const KELAS_INPUT =
  "h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40";
const KELAS_AREA =
  "w-full rounded-xl bg-muted px-4 py-3 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40";

/**
 * Formulir catatan, dipakai dialog tambah maupun ubah.
 *
 * Lingkupnya dipilih di sini, bukan di layar lain: keputusan "siapa yang
 * boleh baca" paling wajar diambil saat menulis, dan bawaannya pribadi.
 */
function FormCatatan({
  pilihan,
  unitBawaan,
  awal,
  onSelesai,
}: {
  pilihan: PilihanOrganisasi;
  unitBawaan: KodeUnit | null;
  awal?: Catatan;
  onSelesai: (hasil: { id?: string; pesan: string | null }) => void;
}) {
  const [judul, setJudul] = useState(awal?.judul ?? "");
  const [isi, setIsi] = useState(awal?.isi ?? "");
  const [kategori, setKategori] = useState<KategoriCatatan>(
    awal?.kategori ?? "lainnya",
  );
  const [visibilitas, setVisibilitas] = useState<VisibilitasCatatan>(
    awal?.visibilitas ?? "pribadi",
  );
  const [unitKode, setUnitKode] = useState<KodeUnit | null>(
    awal?.unitKode ?? unitBawaan,
  );
  const [lampiran, setLampiran] = useState((awal?.lampiran ?? []).join("\n"));
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const daftarLampiran = lampiran
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  const lampiranSah = daftarLampiran.every((l) => /^https?:\/\/\S+$/.test(l));
  const siap =
    judul.trim().length >= 3 &&
    (visibilitas !== "unit" || unitKode !== null) &&
    lampiranSah &&
    !menyimpan;

  const simpan = () => {
    if (!siap) return;
    const input: MasukanCatatan = {
      judul,
      isi,
      kategori,
      visibilitas,
      unitKode: visibilitas === "unit" ? unitKode : null,
      lampiran: daftarLampiran,
    };
    mulai(async () => {
      setPesan(null);
      if (awal) {
        const hasil = await ubahCatatan(awal.id, input);
        if (hasil.ok || hasil.kode === "demo") {
          onSelesai({ pesan: hasil.ok ? null : (hasil.pesan ?? null) });
          return;
        }
        setPesan(hasil.pesan ?? null);
        return;
      }
      const hasil = await tambahCatatan(input);
      if (hasil.ok) {
        onSelesai({ id: hasil.data.id, pesan: null });
        return;
      }
      if (hasil.kode === "demo") {
        onSelesai({ pesan: hasil.pesan ?? null });
        return;
      }
      setPesan(hasil.pesan ?? null);
    });
  };

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="judul-catatan" className={KELAS_LABEL}>
            Judul
          </label>
          <input
            id="judul-catatan"
            value={judul}
            maxLength={160}
            autoComplete="off"
            onChange={(e) => setJudul(e.target.value)}
            placeholder="Mis. Templat chat admin kreator"
            className={KELAS_INPUT}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="isi-catatan" className={KELAS_LABEL}>
            Isi
          </label>
          <textarea
            id="isi-catatan"
            value={isi}
            maxLength={20000}
            rows={8}
            onChange={(e) => setIsi(e.target.value)}
            placeholder="Tulis apa adanya; baris dan paragraf ikut tersimpan."
            className={KELAS_AREA}
          />
        </div>

        <fieldset className="space-y-1.5">
          <legend className={KELAS_LABEL}>Kategori</legend>
          <div className="flex flex-wrap gap-1">
            {KATEGORI_CATATAN_SAH.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKategori(k)}
                aria-pressed={k === kategori}
                className={cn(
                  "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                  k === kategori
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {LABEL_KATEGORI_CATATAN[k]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className={KELAS_LABEL}>Siapa yang boleh membaca</legend>
          <div className="flex flex-wrap gap-1">
            {VISIBILITAS_CATATAN_SAH.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibilitas(v)}
                aria-pressed={v === visibilitas}
                className={cn(
                  "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                  v === visibilitas
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {LABEL_VISIBILITAS[v]}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            {ARTI_VISIBILITAS[visibilitas]} Hanya kamu yang bisa mengubah atau
            menghapusnya.
          </p>
          {visibilitas === "unit" ? (
            <div className="flex flex-wrap gap-1 pt-1">
              {pilihan.unit.map((u) => (
                <button
                  key={u.kode}
                  type="button"
                  onClick={() => setUnitKode(u.kode)}
                  aria-pressed={u.kode === unitKode}
                  className={cn(
                    "tekan-halus h-9 rounded-xl px-3 text-[11px] font-semibold",
                    u.kode === unitKode
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {u.nama}
                </button>
              ))}
            </div>
          ) : null}
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="lampiran-catatan" className={KELAS_LABEL}>
            Lampiran{" "}
            <span className="font-normal text-muted-foreground">
              (opsional, satu tautan per baris)
            </span>
          </label>
          <textarea
            id="lampiran-catatan"
            value={lampiran}
            rows={2}
            onChange={(e) => setLampiran(e.target.value)}
            placeholder="https://…"
            aria-invalid={!lampiranSah}
            className={cn(KELAS_AREA, !lampiranSah && "ring-2 ring-warn/60")}
          />
          {!lampiranSah ? (
            <p className="text-[11px] leading-[14px] text-warn-text">
              Tiap baris harus tautan yang diawali http:// atau https://.
            </p>
          ) : null}
        </div>

        {pesan ? (
          <p
            role="status"
            className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text"
          >
            {pesan}
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
          disabled={!siap}
          onClick={simpan}
          className="tekan-halus rounded-full"
        >
          {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
          {menyimpan
            ? "Menyimpan…"
            : awal
              ? "Simpan perubahan"
              : "Simpan catatan"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function DialogTambahCatatan({
  pilihan,
  unitBawaan,
}: {
  pilihan: PilihanOrganisasi;
  unitBawaan: KodeUnit | null;
}) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogTrigger asChild>
          <Button
            type="button"
            className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
          >
            <Plus className="size-3.5" />
            Tulis catatan
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Catatan baru</DialogTitle>
            <DialogDescription>
              Tersimpan sebagai milikmu. Bagikan ke unit atau perusahaan bila
              orang lain perlu membacanya.
            </DialogDescription>
          </DialogHeader>
          {buka ? (
            <FormCatatan
              pilihan={pilihan}
              unitBawaan={unitBawaan}
              onSelesai={({ id, pesan: p }) => {
                setPesan(p);
                setBuka(false);
                if (id) router.push(`/catatan/${id}`);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      {pesan ? (
        <p
          role="status"
          className="rounded-xl bg-muted px-3 py-2 text-[11px] leading-[14px] text-muted-foreground"
        >
          {pesan}
        </p>
      ) : null}
    </div>
  );
}

export function DialogUbahCatatan({
  catatan,
  pilihan,
  buka,
  onBuka,
}: {
  catatan: Catatan;
  pilihan: PilihanOrganisasi;
  buka: boolean;
  onBuka: (b: boolean) => void;
}) {
  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ubah catatan</DialogTitle>
          <DialogDescription>
            Perubahan langsung terlihat oleh siapa pun yang boleh membacanya.
          </DialogDescription>
        </DialogHeader>
        {buka ? (
          <FormCatatan
            pilihan={pilihan}
            unitBawaan={catatan.unitKode}
            awal={catatan}
            onSelesai={() => onBuka(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
