"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
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
import type { Hasil } from "@/lib/data/hasil";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

const KELAS_LABEL = "text-[13px] leading-[18px] font-semibold";
const KELAS_INPUT =
  "h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40";
const KELAS_AREA =
  "w-full rounded-xl bg-muted px-4 py-3 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40";

/** Sama dengan potongan di server action; hanya ditampilkan, tidak diubah. */
const BATAS_ISI = 20000;
/**
 * Penghitung baru muncul menjelang batas: di bawah itu angkanya cuma
 * gangguan, tetapi tanpa angka orang yang tiba-tiba tidak bisa mengetik
 * lagi tidak tahu sebabnya.
 */
const AMBANG_PENGHITUNG = 18000;

/**
 * Tinggi textarea mengikuti isinya, dibatasi CSS `max-h-*`.
 *
 * `field-sizing: content` belum ada di Chromium lama yang masih dipakai
 * sebagian HP tim, jadi tingginya dihitung sendiri. Mengosongkan tinggi
 * dulu membuat `rows` tetap jadi tinggi minimum.
 */
function useTinggiIkutIsi(
  ref: RefObject<HTMLTextAreaElement | null>,
  isi: string,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Mengecilkan sesaat ke `auto` ikut memendekkan dialog yang bergulir,
    // sehingga posisinya terpotong ke atas di setiap ketikan bila dialog
    // sedang digulir ke bawah. Posisi gulir keduanya dipulihkan.
    const dialog = el.closest<HTMLElement>('[data-slot="dialog-content"]');
    const gulirDialog = dialog?.scrollTop ?? 0;
    const gulirArea = el.scrollTop;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.scrollTop = gulirArea;
    if (dialog) dialog.scrollTop = gulirDialog;
  }, [ref, isi]);
}

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
  refIsi,
  onSelesai,
}: {
  pilihan: PilihanOrganisasi;
  unitBawaan: KodeUnit | null;
  awal?: Catatan;
  /** Dipakai dialog ubah untuk menaruh kursor di akhir isi. */
  refIsi?: RefObject<HTMLTextAreaElement | null>;
  onSelesai: (hasil: {
    id?: string;
    pesan: string | null;
    /** Hanya saat mengubah: dasar pesan berhasil di halaman detail. */
    hasil?: Hasil;
  }) => void;
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
  const refCadangan = useRef<HTMLTextAreaElement>(null);
  const refArea = refIsi ?? refCadangan;
  useTinggiIkutIsi(refArea, isi);

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
          onSelesai({ pesan: hasil.pesan ?? null, hasil });
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
            ref={refArea}
            id="isi-catatan"
            value={isi}
            maxLength={BATAS_ISI}
            // Saat mengubah, isinya sudah ada dan sering panjang; ruang
            // yang lebih tinggi mengurangi gulir di dalam dialog yang juga
            // bergulir.
            rows={awal ? 12 : 8}
            onChange={(e) => setIsi(e.target.value)}
            placeholder="Tulis apa adanya; baris dan paragraf ikut tersimpan."
            aria-describedby={
              isi.length > AMBANG_PENGHITUNG ? "hitung-isi-catatan" : undefined
            }
            className={cn(
              KELAS_AREA,
              "max-h-[50dvh] resize-none overflow-y-auto",
            )}
          />
          {isi.length > AMBANG_PENGHITUNG ? (
            <p
              id="hitung-isi-catatan"
              className={cn(
                "text-right text-[11px] leading-[14px] tabular-nums",
                isi.length >= BATAS_ISI
                  ? "font-semibold text-warn-text"
                  : "text-muted-foreground",
              )}
            >
              {isi.length.toLocaleString("id-ID")} /{" "}
              {BATAS_ISI.toLocaleString("id-ID")} huruf
              {isi.length >= BATAS_ISI ? " — batas tercapai" : ""}
            </p>
          ) : null}
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
  fokusAkhirIsi = false,
  onTersimpan,
}: {
  catatan: Catatan;
  pilihan: PilihanOrganisasi;
  buka: boolean;
  onBuka: (b: boolean) => void;
  /**
   * Kebanyakan orang membuka catatan lamanya untuk menyambung tulisan,
   * bukan mengganti judul — jadi kursor langsung ditaruh di akhir isi.
   */
  fokusAkhirIsi?: boolean;
  onTersimpan?: (hasil: Hasil) => void;
}) {
  const refIsi = useRef<HTMLTextAreaElement>(null);

  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent
        // Fokus diatur di sini, bukan lewat `autoFocus`: Radix memindahkan
        // fokus setelah dialog terpasang dan akan menimpa fokus yang
        // dipasang lebih awal.
        onOpenAutoFocus={(e) => {
          const el = refIsi.current;
          if (!fokusAkhirIsi || !el) return;
          e.preventDefault();
          const akhir = el.value.length;
          el.focus({ preventScroll: true });
          el.setSelectionRange(akhir, akhir);
          el.scrollTop = el.scrollHeight;
        }}
        className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-2xl"
      >
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
            refIsi={refIsi}
            onSelesai={({ hasil }) => {
              onBuka(false);
              if (hasil) onTersimpan?.(hasil);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
