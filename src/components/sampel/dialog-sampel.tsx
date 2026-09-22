"use client";

import { useState, useTransition } from "react";
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
import { tambahSampel, ubahSampel } from "@/app/actions/sampel";
import { tautanProdukSah, type Sampel } from "@/lib/sampel";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

const KATEGORI = ["Skincare", "Fashion", "Gadget", "F&B", "Home", "Lainnya"];

type Masukan = {
  kode: string;
  nama: string;
  kategori: string;
  unitKode: KodeUnit | null;
  akunId: string | null;
  nilai: number;
  brand: string;
  kreator: string;
  linkProduk: string;
  catatan: string;
};

function Isian({
  awal,
  pilihan,
  onSimpan,
  menyimpan,
  pesan,
  kodeBerikutnya = null,
}: {
  awal?: Sampel;
  pilihan: PilihanOrganisasi;
  onSimpan: (data: Masukan) => void;
  menyimpan: boolean;
  pesan: string | null;
  /** Kode urut berikutnya, ditampilkan sebagai ancar-ancar. */
  kodeBerikutnya?: string | null;
}) {
  const [kode, setKode] = useState(awal?.kode ?? "");
  const [nama, setNama] = useState(awal?.nama ?? "");
  const [kategori, setKategori] = useState(awal?.kategori ?? "Skincare");
  const [unitKode, setUnitKode] = useState<KodeUnit | null>(
    awal?.unitKode ?? null,
  );
  const [akunId, setAkunId] = useState<string | null>(awal?.akunId ?? null);
  const [nilai, setNilai] = useState(String(awal?.nilai ?? ""));
  const [brand, setBrand] = useState(awal?.brand ?? "");
  const [kreator, setKreator] = useState(awal?.kreator ?? "");
  const [linkProduk, setLinkProduk] = useState(awal?.linkProduk ?? "");
  const [catatan, setCatatan] = useState(awal?.catatan ?? "");

  // Akun hanya ditawarkan untuk unit yang sedang dipilih: database
  // menolak akun dari unit lain (0083), jadi jangan sampai ditawarkan.
  const akunUnit = pilihan.akun.filter(
    (a) => unitKode !== null && a.unitKode === unitKode,
  );

  const angka = Number(nilai.replace(/\./g, ""));
  // Kode boleh dikosongkan saat menambah: database membangkitkannya
  // berurutan sekaligus menyisipkan barisnya (0081), jadi tidak ada dua
  // orang yang bisa mendapat nomor yang sama.
  const kodeOtomatis = awal === undefined && kode.trim() === "";
  // Tautan boleh kosong, tetapi kalau diisi harus benar-benar bisa
  // dibuka — link yang salah ketik baru ketahuan saat orang menekannya.
  const tautanKeliru = linkProduk.trim() !== "" && !tautanProdukSah(linkProduk);

  const siap =
    (kodeOtomatis || /^[A-Z0-9][A-Z0-9-]{2,29}$/i.test(kode.trim())) &&
    nama.trim().length >= 3 &&
    Number.isFinite(angka) &&
    angka >= 0 &&
    !tautanKeliru;

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="kode-sampel"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Kode QR
          </label>
          <input
            id="kode-sampel"
            value={kode}
            maxLength={30}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setKode(e.target.value.toUpperCase())}
            placeholder={kodeBerikutnya ?? "SMP-0011"}
            className="tabular h-12 w-full rounded-xl bg-muted px-4 font-mono text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
            {kodeOtomatis
              ? `Dikosongkan berarti dinomori otomatis berurutan${
                  kodeBerikutnya ? ` — berikutnya ${kodeBerikutnya}` : ""
                }. Kode inilah yang dicetak pada stikernya.`
              : "Kode inilah yang dicetak pada stikernya dan dibaca pemindai."}
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="nama-sampel"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Nama produk
          </label>
          <input
            id="nama-sampel"
            value={nama}
            maxLength={120}
            autoComplete="off"
            onChange={(e) => setNama(e.target.value)}
            placeholder="Mis. Serum Vitamin C 30ml"
            className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-[18px] font-semibold">
            Kategori
          </legend>
          <div className="flex flex-wrap gap-1">
            {KATEGORI.map((k) => (
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
                {k}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-[18px] font-semibold">
            Unit pemilik{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </legend>
          <div className="flex flex-wrap gap-1">
            {pilihan.unit.map((u) => (
              <button
                key={u.kode}
                type="button"
                onClick={() => setUnitKode(unitKode === u.kode ? null : u.kode)}
                aria-pressed={u.kode === unitKode}
                className={cn(
                  "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                  u.kode === unitKode
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {u.nama}
              </button>
            ))}
          </div>
        </fieldset>

        {akunUnit.length > 0 ? (
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Akun pemakai{" "}
              <span className="font-normal text-muted-foreground">
                (boleh kosong)
              </span>
            </legend>
            <div className="flex flex-wrap gap-1">
              {akunUnit.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAkunId(akunId === a.id ? null : a.id)}
                  aria-pressed={a.id === akunId}
                  className={cn(
                    "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                    a.id === akunId
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {a.username}
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              PIC akun ikut melihat sampel yang beredar untuk akunnya.
            </p>
          </fieldset>
        ) : null}

        <div className="space-y-1.5">
          <label
            htmlFor="nilai-sampel"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Nilai barang (Rp)
          </label>
          <input
            id="nilai-sampel"
            inputMode="numeric"
            value={nilai}
            maxLength={12}
            autoComplete="off"
            onChange={(e) => setNilai(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="185000"
            className="tabular h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Dipakai menghitung nilai barang yang sedang di luar gudang.
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="brand-sampel"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Brand / seller{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </label>
          <input
            id="brand-sampel"
            value={brand}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Mis. Glowrich Official"
            className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="kreator-sampel-form"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Creator / PIC{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </label>
          <input
            id="kreator-sampel-form"
            value={kreator}
            maxLength={80}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setKreator(e.target.value)}
            placeholder="@nama.kreator"
            className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
            Diisi saat sudah diketahui; pencatatan perpindahan juga
            memperbaruinya sendiri.
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="link-sampel"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Link produk{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </label>
          <input
            id="link-sampel"
            type="url"
            inputMode="url"
            value={linkProduk}
            maxLength={300}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setLinkProduk(e.target.value)}
            placeholder="https://shopee.co.id/… atau https://tiktok.com/…"
            aria-invalid={tautanKeliru}
            className="h-12 w-full rounded-xl bg-muted px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <p
            className={cn(
              "text-[11px] leading-[14px] text-pretty",
              tautanKeliru ? "text-warn-text" : "text-muted-foreground",
            )}
          >
            {tautanKeliru
              ? "Tautan harus diawali http:// atau https://."
              : "Bisa diganti kapan saja tanpa mencetak ulang stiker QR."}
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="catatan-sampel"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Catatan{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </label>
          <input
            id="catatan-sampel"
            value={catatan}
            maxLength={200}
            autoComplete="off"
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Mis. kemasan mudah penyok"
            className="h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        {awal ? (
          <p className="rounded-xl bg-muted px-3 py-2 text-[11px] leading-[14px] text-pretty text-muted-foreground">
            Status dan pemegangnya tidak diubah di sini — keduanya hanya
            berpindah lewat pencatatan perpindahan, supaya riwayatnya selalu
            cocok dengan keadaannya.
          </p>
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
          onClick={() =>
            onSimpan({
              kode,
              nama,
              kategori,
              unitKode,
              // Akun hanya berarti bila unitnya memang punya akun.
              akunId: akunUnit.some((a) => a.id === akunId) ? akunId : null,
              nilai: angka,
              brand,
              kreator,
              linkProduk,
              catatan,
            })
          }
          className="tekan-halus rounded-full"
        >
          {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
          {menyimpan ? "Menyimpan…" : "Simpan"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Tambah sampel baru. */
export function DialogTambahSampel({
  pilihan,
  kodeBerikutnya = null,
}: {
  pilihan: PilihanOrganisasi;
  /** Ancar-ancar nomor berikutnya, dihitung server saat halaman dimuat. */
  kodeBerikutnya?: string | null;
}) {
  const [buka, setBuka] = useState(false);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <Plus className="size-3.5" />
          Tambah sampel
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah sampel</DialogTitle>
          <DialogDescription>
            Sampel baru selalu dimulai di gudang dengan status tersedia.
          </DialogDescription>
        </DialogHeader>

        <Isian
          pilihan={pilihan}
          kodeBerikutnya={kodeBerikutnya}
          menyimpan={menyimpan}
          pesan={pesan}
          onSimpan={(data) =>
            mulai(async () => {
              setPesan(null);
              const hasil = await tambahSampel(data);
              if (hasil.ok || hasil.kode === "demo") {
                setBuka(false);
                if (!hasil.ok) setPesan(hasil.pesan ?? null);
                return;
              }
              setPesan(hasil.pesan ?? null);
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/** Ubah keterangan sampel yang sudah ada. */
export function DialogUbahSampel({
  sampel,
  pilihan,
  buka,
  onBuka,
}: {
  sampel: Sampel;
  pilihan: PilihanOrganisasi;
  buka: boolean;
  onBuka: (b: boolean) => void;
}) {
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah {sampel.kode}</DialogTitle>
          <DialogDescription>
            Keterangan barangnya; perpindahannya dicatat terpisah.
          </DialogDescription>
        </DialogHeader>

        <Isian
          awal={sampel}
          pilihan={pilihan}
          menyimpan={menyimpan}
          pesan={pesan}
          onSimpan={(data) =>
            mulai(async () => {
              setPesan(null);
              const hasil = await ubahSampel(sampel.id, data);
              if (hasil.ok || hasil.kode === "demo") {
                onBuka(false);
                if (!hasil.ok) setPesan(hasil.pesan ?? null);
                return;
              }
              setPesan(hasil.pesan ?? null);
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
