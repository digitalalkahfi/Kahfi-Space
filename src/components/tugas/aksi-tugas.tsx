"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DialogTiket } from "@/components/tugas/dialog-tiket";
import { DialogToDo } from "@/components/tugas/dialog-todo";
import { hapusTugas } from "@/app/actions/tugas";
import type { GoalRingkas } from "@/lib/data/goal";
import type { Pengguna, Tugas } from "@/lib/types";

type AksiTugas = {
  ubah: (tugas: Tugas) => void;
  hapus: (tugas: Tugas) => void;
};

const KonteksAksi = createContext<AksiTugas | null>(null);

/**
 * Tombol Edit & Hapus di kartu tugas. Null di luar `PenyediaAksiTugas` —
 * kartu yang tampil di tempat lain tidak menampilkan tombolnya.
 */
export function useAksiTugas() {
  return useContext(KonteksAksi);
}

/**
 * Satu dialog edit dan satu dialog hapus untuk seluruh papan atau daftar,
 * bukan satu per kartu. Kartu cukup meminta lewat `useAksiTugas()`;
 * dialognya dirakit di sini dengan daftar penerima & goal yang sama dengan
 * tombol "Buat tiket".
 */
export function PenyediaAksiTugas({
  children,
  penerima,
  goal,
  hariIni,
  akhirPekan,
}: {
  children: React.ReactNode;
  penerima: Pengguna[];
  goal: GoalRingkas[];
  hariIni: string;
  akhirPekan: string;
}) {
  const [diubah, setDiubah] = useState<Tugas | null>(null);
  const [dihapus, setDihapus] = useState<Tugas | null>(null);
  const aksi = useMemo<AksiTugas>(
    () => ({ ubah: setDiubah, hapus: setDihapus }),
    [],
  );

  return (
    <KonteksAksi.Provider value={aksi}>
      {children}

      {/* Dipasang ulang per tugas (key) supaya isiannya selalu mulai dari
          nilai tugas itu, bukan sisa suntingan sebelumnya. */}
      {diubah?.tipe === "pribadi" ? (
        <DialogToDo
          key={diubah.id}
          ubah={diubah}
          onTutup={() => setDiubah(null)}
          hariIni={hariIni}
          tanggalAwal={hariIni}
        />
      ) : null}
      {diubah && diubah.tipe !== "pribadi" ? (
        <DialogTiket
          key={diubah.id}
          ubah={diubah}
          onTutup={() => setDiubah(null)}
          penerima={penerima}
          goal={goal}
          hariIni={hariIni}
          tanggalAwal={hariIni}
          akhirPekan={akhirPekan}
        />
      ) : null}
      {dihapus ? (
        <DialogHapusTugas
          key={dihapus.id}
          tugas={dihapus}
          onTutup={() => setDihapus(null)}
        />
      ) : null}
    </KonteksAksi.Provider>
  );
}

/**
 * Konfirmasi hapus. Untuk tiket, dialognya menyebut siapa yang akan diberi
 * tahu dan apa yang ikut hilang — penghapusan tidak bisa dibatalkan.
 */
function DialogHapusTugas({
  tugas,
  onTutup,
}: {
  tugas: Tugas;
  onTutup: () => void;
}) {
  const [buka, setBuka] = useState(true);
  const [menghapus, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const todo = tugas.tipe === "pribadi";
  const jenis = todo
    ? "to-do"
    : tugas.tipe === "komitmen_mingguan"
      ? "komitmen"
      : "tiket";
  const sudahDikerjakan = !todo && tugas.statusAsli !== "todo";

  const bukaTutup = (b: boolean) => {
    setBuka(b);
    if (!b) onTutup();
  };

  const hapus = () => {
    if (menghapus) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await hapusTugas(tugas.id);
      if (hasil.ok) bukaTutup(false);
      else setPesan(hasil.pesan);
    });
  };

  return (
    <Dialog open={buka} onOpenChange={bukaTutup}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hapus {jenis} ini?</DialogTitle>
          <DialogDescription className="text-pretty">
            &ldquo;{tugas.judul}&rdquo; akan dihapus permanen dan tidak bisa
            dikembalikan.
          </DialogDescription>
        </DialogHeader>

        {todo ? null : (
          <ul className="space-y-1.5 rounded-2xl bg-muted/60 px-4 py-3 text-[13px] leading-[18px]">
            <li className="ml-4 list-disc text-pretty marker:text-muted-foreground">
              {tugas.penerimaLengkap} akan diberi tahu bahwa {jenis} ini
              dihapus.
            </li>
            {sudahDikerjakan ? (
              <li className="ml-4 list-disc text-pretty marker:text-muted-foreground">
                {tugas.penerimaLengkap} sudah mulai mengerjakannya; hasil kerja
                dan riwayat pemeriksaannya ikut terhapus.
              </li>
            ) : null}
          </ul>
        )}

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
            variant="destructive"
            disabled={menghapus}
            onClick={hapus}
            className="tekan-halus rounded-full"
          >
            {menghapus ? <Loader2 className="size-4 animate-spin" /> : null}
            {menghapus ? "Menghapus…" : `Hapus ${jenis}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
