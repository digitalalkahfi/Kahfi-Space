"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Pencil } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PesanAksi, type NadaPesan } from "@/components/shared/pesan-aksi";
import { ubahFotoSaya, ubahNamaSaya } from "@/app/actions/profil";
import { unggahFotoProfil } from "@/lib/data/foto-profil";
import {
  AVATAR_TIPE,
  NAMA_MAKS,
  inisialNama,
  periksaBerkasAvatar,
  periksaNama,
  rapikanNama,
} from "@/lib/profil";

/**
 * Menyunting identitas diri: nama tampilan dan foto.
 *
 * Hanya dua hal itu — sisanya milik pengelola, dan halaman profil sudah
 * menjelaskan alasannya. Fotonya ditampilkan sebagai pratinjau seketika
 * supaya orang tahu hasil pangkasan bulatnya sebelum menyimpan.
 */
export function DialogIdentitas({
  namaAwal,
  fotoAwal,
}: {
  namaAwal: string;
  fotoAwal: string | null;
}) {
  const [buka, setBuka] = useState(false);
  const [nama, setNama] = useState(namaAwal);
  const [pratinjau, setPratinjau] = useState<string | null>(fotoAwal);
  const [pesan, setPesan] = useState<string | null>(null);
  const [nada, setNada] = useState<NadaPesan>("netral");
  const [mintaKonfirmasi, setMintaKonfirmasi] = useState(false);
  const [menyimpan, mulai] = useTransition();
  const berkasRef = useRef<HTMLInputElement>(null);
  // Berkas aslinya disimpan terpisah dari URL pratinjau: yang diunggah
  // adalah berkasnya, yang ditampilkan adalah blob URL sementara.
  const [berkasFoto, setBerkasFoto] = useState<File | null>(null);

  const periksa = periksaNama(nama);
  const berubah = rapikanNama(nama) !== namaAwal || berkasFoto !== null;
  const siap = periksa.ok && berubah && !menyimpan;

  const pilihFoto = (berkas: File | undefined) => {
    if (!berkas) return;
    const cek = periksaBerkasAvatar(berkas);
    if (!cek.ok) {
      setNada("gagal");
      setPesan(cek.pesan ?? "Berkas tidak bisa dipakai.");
      return;
    }
    setPesan(null);
    setBerkasFoto(berkas);
    setPratinjau(URL.createObjectURL(berkas));
  };

  const simpan = () => {
    if (!siap) return;
    mulai(async () => {
      const pesanTerkumpul: string[] = [];
      let semuaOk = true;
      let adaYangDemo = false;

      if (rapikanNama(nama) !== namaAwal) {
        const hasil = await ubahNamaSaya(nama);
        if (hasil.pesan) pesanTerkumpul.push(hasil.pesan);
        if (!hasil.ok) {
          semuaOk = false;
          if (hasil.kode === "demo") adaYangDemo = true;
        }
      }

      if (berkasFoto !== null) {
        // Berkasnya naik dari browser langsung ke Storage; yang dikirim
        // ke server hanya alamatnya.
        const unggah = await unggahFotoProfil(berkasFoto);
        if (!unggah.ok) {
          pesanTerkumpul.push(unggah.pesan);
          semuaOk = false;
        } else {
          const hasil = await ubahFotoSaya(unggah.url);
          if (hasil.pesan) pesanTerkumpul.push(hasil.pesan);
          if (!hasil.ok) {
            semuaOk = false;
            if (hasil.kode === "demo") adaYangDemo = true;
          }
        }
      }

      setMintaKonfirmasi(false);
      setNada(semuaOk ? "berhasil" : adaYangDemo ? "netral" : "gagal");
      setPesan(pesanTerkumpul.join(" ") || null);
      if (semuaOk) setBuka(false);
    });
  };

  return (
    <Dialog
      open={buka}
      onOpenChange={(b) => {
        setBuka(b);
        if (!b) {
          setNama(namaAwal);
          setPratinjau(fotoAwal);
          setBerkasFoto(null);
          setPesan(null);
          setMintaKonfirmasi(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <Pencil className="size-3.5" />
          Ubah identitas
        </Button>
      </DialogTrigger>

      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah identitas diri</DialogTitle>
          <DialogDescription>
            Nama tampilan dan foto ini yang dilihat rekanmu di daftar tim, kolom
            PIC, dan riwayat kegiatan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-16 shrink-0">
              {pratinjau ? (
                <AvatarImage src={pratinjau} alt="" />
              ) : (
                <AvatarFallback className="bg-primary text-base font-bold text-primary-foreground">
                  {inisialNama(nama)}
                </AvatarFallback>
              )}
            </Avatar>

            <div className="min-w-0 space-y-1.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => berkasRef.current?.click()}
                className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
              >
                <ImagePlus className="size-3.5" />
                Pilih foto
              </Button>
              <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                JPG, PNG, atau WebP. Maksimal 2 MB.
              </p>
              <input
                ref={berkasRef}
                type="file"
                accept={AVATAR_TIPE.join(",")}
                className="hidden"
                onChange={(e) => pilihFoto(e.target.files?.[0])}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="nama-tampilan"
              className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
            >
              Nama tampilan
            </label>
            <Input
              id="nama-tampilan"
              value={nama}
              maxLength={NAMA_MAKS + 10}
              onChange={(e) => setNama(e.target.value)}
              aria-invalid={nama.trim() !== "" && !periksa.ok}
              placeholder="Nama lengkap"
            />
            {nama.trim() !== "" && !periksa.ok ? (
              <p className="text-[11px] leading-[14px] text-pretty text-warn-text">
                {periksa.pesan}
              </p>
            ) : null}
          </div>

          {mintaKonfirmasi ? (
            <PesanAksi nada="netral">
              Nama dan foto ini akan terlihat oleh seluruh tim — di daftar
              anggota, kolom PIC, dan riwayat kegiatan. Tekan Simpan sekali lagi
              untuk melanjutkan.
            </PesanAksi>
          ) : null}

          {pesan ? <PesanAksi nada={nada}>{pesan}</PesanAksi> : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
            >
              Batal
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() => {
              // Konfirmasi di tempat, bukan dialog di atas dialog: yang
              // perlu dibaca ulang justru pratinjau foto dan nama yang
              // sedang tampak, dan dialog kedua akan menutupinya.
              if (!mintaKonfirmasi) {
                setPesan(null);
                setMintaKonfirmasi(true);
                return;
              }
              simpan();
            }}
            disabled={!siap}
            className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
          >
            {menyimpan ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {mintaKonfirmasi ? "Ya, simpan" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
