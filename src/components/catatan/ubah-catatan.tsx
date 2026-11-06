"use client";

import {
  createContext,
  useContext,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { DialogUbahCatatan } from "@/components/catatan/dialog-catatan";
import { cn } from "@/lib/utils";
import type { Hasil } from "@/lib/data/hasil";
import type { Catatan } from "@/lib/catatan";
import type { PilihanOrganisasi } from "@/lib/types";

type KonteksUbah = {
  /** Buka dialog ubah dengan kursor siap di akhir isi. */
  bukaUbah: () => void;
  /** Kabar aksi terakhir (ubah atau sematkan) — satu tempat, satu pesan. */
  hasil: Hasil | null;
  setHasil: (h: Hasil | null) => void;
};

const Konteks = createContext<KonteksUbah | null>(null);

/**
 * Pemilik dialog ubah di halaman detail.
 *
 * Dialognya dipasang sekali di sini karena ada dua pintu masuk yang
 * berjauhan — tombol di kartu judul dan kartu isi itu sendiri — dan
 * keduanya harus berujung pada dialog serta pesan berhasil yang sama.
 */
export function PenyediaUbahCatatan({
  catatan,
  pilihan,
  children,
}: {
  catatan: Catatan;
  pilihan: PilihanOrganisasi;
  children: ReactNode;
}) {
  const [buka, setBuka] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);

  const bukaUbah = () => {
    // Pesan lama dibuang supaya "Catatan diperbarui." yang muncul nanti
    // memang milik simpanan yang baru, bukan sisa yang sebelumnya.
    setHasil(null);
    setBuka(true);
  };

  return (
    <Konteks.Provider value={{ bukaUbah, hasil, setHasil }}>
      {children}
      <DialogUbahCatatan
        catatan={catatan}
        pilihan={pilihan}
        buka={buka}
        onBuka={setBuka}
        fokusAkhirIsi
        onTersimpan={(h) =>
          setHasil(h.ok ? { ...h, pesan: h.pesan ?? "Catatan diperbarui." } : h)
        }
      />
    </Konteks.Provider>
  );
}

export function useUbahCatatan(): KonteksUbah {
  const k = useContext(Konteks);
  if (!k) {
    throw new Error("useUbahCatatan harus di dalam PenyediaUbahCatatan.");
  }
  return k;
}

/**
 * Isi catatan yang bisa diketuk pemiliknya untuk langsung menulis.
 *
 * Sengaja bukan `<button>`: isi catatan sering berupa templat yang
 * disalin, dan teks di dalam tombol tidak bisa diseleksi. Jadi ketukan
 * yang ternyata menyeleksi teks dibiarkan menyeleksi; pembaca layar dan
 * papan ketik memakai tombol "Ubah / tambah tulisan" yang setara.
 */
export function IsiBisaDiketuk({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { bukaUbah } = useUbahCatatan();

  const ketuk = (e: MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) return;
    const seleksi = window.getSelection()?.toString() ?? "";
    if (seleksi.trim() !== "") return;
    bukaUbah();
  };

  return (
    <div
      onClick={ketuk}
      title="Ketuk untuk mengubah atau menambah tulisan"
      className={cn(
        "-mx-2 cursor-text rounded-xl px-2 py-1 transition-colors hover:bg-muted/50",
        className,
      )}
    >
      {children}
    </div>
  );
}
