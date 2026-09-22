"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
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
  GAYA_JENIS,
  GAYA_KEPARAHAN,
  LABEL_JENIS,
  LABEL_KEPARAHAN,
  masukanSerupa,
  type JenisMasukan,
  type Keparahan,
  type Masukan,
} from "@/lib/masukan";
import { kirimMasukan } from "@/app/actions/masukan";

const JENIS: JenisMasukan[] = ["bug", "saran", "pertanyaan"];
const KEPARAHAN: Keparahan[] = ["ringan", "sedang", "berat", "kritis"];

/**
 * Kirim masukan atau laporan bug.
 *
 * Isian menyesuaikan jenisnya: untuk bug, halaman dan langkah yang
 * menghasilkannya diminta jelas — itulah dua hal yang paling sering
 * hilang dan membuat laporan berakhir "tidak bisa ditiru".
 */
export function DialogKirimMasukan({
  halamanBawaan,
  terbuka = [],
}: {
  halamanBawaan?: string;
  /** Laporan yang masih terbuka, untuk menandai kemungkinan kembaran. */
  terbuka?: Masukan[];
}) {
  const [buka, setBuka] = useState(false);
  const [jenis, setJenis] = useState<JenisMasukan>("saran");
  const [judul, setJudul] = useState("");
  const [isi, setIsi] = useState("");
  const [keparahan, setKeparahan] = useState<Keparahan>("sedang");
  const [halaman, setHalaman] = useState(halamanBawaan ?? "");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const bug = jenis === "bug";
  // Dihitung di browser dari daftar yang sudah dimuat halaman: tidak
  // perlu permintaan tambahan setiap kali orang mengetik satu huruf.
  const serupa = useMemo(
    () => (judul.trim().length >= 10 ? masukanSerupa(judul, terbuka) : []),
    [judul, terbuka],
  );

  const siap = judul.trim().length >= 10 && (!bug || isi.trim().length >= 20);

  const simpan = () => {
    if (!siap || menyimpan) return;
    mulai(async () => {
      setPesan(null);
      const hasil = await kirimMasukan({
        jenis,
        judul,
        isi,
        keparahan: bug ? keparahan : null,
        halaman,
      });

      if (hasil.ok || hasil.kode === "demo") {
        setJudul("");
        setIsi("");
        setBuka(false);
        if (!hasil.ok) setPesan(hasil.pesan ?? null);
        return;
      }
      setPesan(hasil.pesan ?? null);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <Plus className="size-3.5" />
          Kirim masukan
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kirim masukan</DialogTitle>
          <DialogDescription>
            Semua orang bisa melihatnya, termasuk tindak lanjutnya.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Jenis
            </legend>
            <div className="flex flex-wrap gap-1">
              {JENIS.map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setJenis(j)}
                  aria-pressed={j === jenis}
                  className={cn(
                    "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                    j === jenis
                      ? "bg-primary text-primary-foreground"
                      : GAYA_JENIS[j],
                  )}
                >
                  {LABEL_JENIS[j]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label
              htmlFor="judul-masukan"
              className="text-[13px] leading-[18px] font-semibold"
            >
              {bug ? "Apa yang rusak" : "Apa yang ingin disampaikan"}
            </label>
            <input
              id="judul-masukan"
              value={judul}
              maxLength={160}
              autoComplete="off"
              onChange={(e) => setJudul(e.target.value)}
              placeholder={
                bug
                  ? "Mis. Absensi selfie gagal terbuka di Android 8"
                  : "Mis. Tambahkan pengingat laporan harian jam 17.00"
              }
              className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />

            {serupa.length > 0 ? (
              <div className="rounded-xl bg-warn-fill px-3 py-2">
                <p className="text-[11px] leading-[14px] text-pretty text-warn-text">
                  Sudah ada laporan yang mirip. Mendukung yang sudah ada lebih
                  cepat ditindak daripada laporan kembar.
                </p>
                <ul className="mt-1 space-y-0.5">
                  {serupa.map((x) => (
                    <li key={x.masukan.id}>
                      <Link
                        href={`/masukan/${x.masukan.id}`}
                        className="text-[11px] leading-[14px] font-semibold text-pretty underline-offset-2 hover:underline"
                      >
                        {x.masukan.judul}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="isi-masukan"
              className="text-[13px] leading-[18px] font-semibold"
            >
              {bug ? "Langkah yang menghasilkannya" : "Keterangan"}
              {bug ? null : (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  (opsional)
                </span>
              )}
            </label>
            <textarea
              id="isi-masukan"
              value={isi}
              maxLength={2000}
              rows={4}
              onChange={(e) => setIsi(e.target.value)}
              placeholder={
                bug
                  ? "1) Buka halaman absensi 2) Tekan ambil foto 3) Kamera tidak terbuka. Perangkat: Android 8."
                  : "Ceritakan secukupnya."
              }
              className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] leading-[20px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {bug ? (
              <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                Sebutkan langkahnya berurutan. Tanpa itu, laporan bug hampir
                selalu berakhir &ldquo;tidak bisa ditiru&rdquo;.
              </p>
            ) : null}
          </div>

          {bug ? (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="halaman-masukan"
                  className="text-[13px] leading-[18px] font-semibold"
                >
                  Halaman tempat ditemui
                </label>
                <input
                  id="halaman-masukan"
                  value={halaman}
                  maxLength={120}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setHalaman(e.target.value)}
                  placeholder="/absensi"
                  className="h-11 w-full rounded-xl bg-muted px-4 font-mono text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </div>

              <fieldset className="space-y-1.5">
                <legend className="text-[13px] leading-[18px] font-semibold">
                  Seberapa parah
                </legend>
                <div className="flex flex-wrap gap-1">
                  {KEPARAHAN.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKeparahan(k)}
                      aria-pressed={k === keparahan}
                      className={cn(
                        "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                        k === keparahan
                          ? "bg-primary text-primary-foreground"
                          : GAYA_KEPARAHAN[k],
                      )}
                    >
                      {LABEL_KEPARAHAN[k]}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  Kritis berarti pekerjaan berhenti sama sekali, bukan sekadar
                  mengganggu.
                </p>
              </fieldset>
            </>
          ) : null}

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
            disabled={!siap || menyimpan}
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            Kirim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
