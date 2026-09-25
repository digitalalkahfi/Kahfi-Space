"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogKonfirmasi } from "@/components/shared/dialog-konfirmasi";
import { PesanAksi, nadaHasil } from "@/components/shared/pesan-aksi";
import { DialogUbahCatatan } from "@/components/catatan/dialog-catatan";
import { hapusCatatan, sematkanCatatan } from "@/app/actions/catatan";
import type { Hasil } from "@/lib/data/hasil";
import type { Catatan } from "@/lib/catatan";
import type { PilihanOrganisasi } from "@/lib/types";

/** Tombol milik penulis: sematkan, ubah, hapus. */
export function AksiCatatan({
  catatan,
  pilihan,
}: {
  catatan: Catatan;
  pilihan: PilihanOrganisasi;
}) {
  const router = useRouter();
  const [ubah, setUbah] = useState(false);
  const [memproses, mulai] = useTransition();
  const [hasil, setHasil] = useState<Hasil | null>(null);

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
        <Button
          type="button"
          variant="outline"
          onClick={() => setUbah(true)}
          className="tekan-halus sentuh-nyaman h-8 rounded-full px-3 text-[11px] font-semibold"
        >
          <Pencil className="size-3.5" />
          Ubah
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

      {hasil ? (
        <PesanAksi nada={nadaHasil(hasil)}>{hasil.pesan}</PesanAksi>
      ) : null}

      <DialogUbahCatatan
        catatan={catatan}
        pilihan={pilihan}
        buka={ubah}
        onBuka={setUbah}
      />
    </div>
  );
}
