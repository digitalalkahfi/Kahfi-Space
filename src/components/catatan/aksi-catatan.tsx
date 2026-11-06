"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PencilLine, Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogKonfirmasi } from "@/components/shared/dialog-konfirmasi";
import { PesanAksi, nadaHasil } from "@/components/shared/pesan-aksi";
import { useUbahCatatan } from "@/components/catatan/ubah-catatan";
import { hapusCatatan, sematkanCatatan } from "@/app/actions/catatan";
import type { Catatan } from "@/lib/catatan";

/**
 * Tombol milik penulis: ubah, sematkan, hapus.
 *
 * Ubah dibuat tombol utama yang besar karena laporan pengguna: tombol
 * kecil sejajar Sematkan/Hapus tidak terbaca sebagai jalan untuk
 * menyambung tulisan, sehingga catatan lama terasa "tidak bisa dibuka".
 */
export function AksiCatatan({ catatan }: { catatan: Catatan }) {
  const router = useRouter();
  const { bukaUbah, hasil, setHasil } = useUbahCatatan();
  const [memproses, mulai] = useTransition();

  const sematkan = () => {
    if (memproses) return;
    mulai(async () => {
      setHasil(await sematkanCatatan(catatan.id, !catatan.disematkan));
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          onClick={bukaUbah}
          className="tekan-halus h-10 rounded-full px-4 text-[13px] font-semibold"
        >
          <PencilLine className="size-4" />
          Ubah / tambah tulisan
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={memproses}
          onClick={sematkan}
          className="tekan-halus sentuh-nyaman h-8 rounded-full px-3 text-[11px] font-semibold"
        >
          {memproses ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : catatan.disematkan ? (
            <PinOff className="size-3.5" />
          ) : (
            <Pin className="size-3.5" />
          )}
          {catatan.disematkan ? "Lepas sematan" : "Sematkan"}
        </Button>
        <DialogKonfirmasi
          pemicu={
            <Button
              type="button"
              variant="outline"
              className="tekan-halus sentuh-nyaman h-8 rounded-full px-3 text-[11px] font-semibold text-danger-text"
            >
              <Trash2 className="size-3.5" />
              Hapus
            </Button>
          }
          judul="Hapus catatan ini?"
          pesan="Isinya hilang untuk semua yang bisa membacanya, dan tidak bisa dikembalikan."
          labelYa="Hapus catatan"
          berbahaya
          onSetuju={async () => {
            const h = await hapusCatatan(catatan.id);
            if (h.ok) router.push("/catatan");
            return h;
          }}
        />
      </div>

      {hasil?.pesan ? (
        <PesanAksi nada={nadaHasil(hasil)}>{hasil.pesan}</PesanAksi>
      ) : null}
    </div>
  );
}
