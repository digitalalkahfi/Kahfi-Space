"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buatAkunLogin, type AkunLoginBaru } from "@/app/actions/anggota";
import type { AnggotaTim } from "@/lib/types";

/** Pesan siap kirim (WA) berisi alamat masuk, email, dan sandi sementara. */
function pesanUntuk(akun: AkunLoginBaru) {
  const alamat =
    typeof window === "undefined"
      ? "/masuk"
      : `${window.location.origin}/masuk`;
  return [
    `Assalamu'alaikum ${akun.nama}, akun K-Space V2 sudah dibuat.`,
    `Masuk di: ${alamat}`,
    `Email: ${akun.email}`,
    `Kata sandi sementara: ${akun.sandi}`,
    "Setelah masuk, ganti kata sandinya dengan kata sandi milikmu sendiri.",
  ].join("\n");
}

/**
 * Kredensial akun login yang baru dibuat. Kata sandi sementara hanya ada
 * di layar ini — aplikasi tidak menyimpannya — jadi diteruskan langsung
 * ke orangnya, sebaiknya lewat pesan pribadi.
 */
export function PanelAkunLogin({
  akun,
  onSelesai,
}: {
  akun: AkunLoginBaru;
  onSelesai: () => void;
}) {
  const [tersalin, setTersalin] = useState(false);

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(pesanUntuk(akun));
      setTersalin(true);
    } catch {
      setTersalin(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl bg-muted p-4">
        <div>
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Email
          </p>
          <p className="text-[15px] leading-5 font-semibold break-all">
            {akun.email}
          </p>
        </div>
        <div>
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Kata sandi sementara
          </p>
          <p className="tabular font-mono text-[18px] leading-6 font-bold tracking-wide select-all">
            {akun.sandi}
          </p>
        </div>
      </div>

      <p className="rounded-xl bg-warn-fill px-3 py-2 text-[12px] leading-[16px] text-warn-text">
        Kata sandi ini hanya tampil sekali dan tidak disimpan K-Space. Kirim ke{" "}
        {akun.nama} lewat pesan pribadi. Saat pertama masuk, ia diminta
        menggantinya dengan kata sandi miliknya sendiri.
      </p>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={salin}
          className="tekan-halus rounded-full"
        >
          {tersalin ? (
            <Check className="size-4" />
          ) : (
            <Copy className="size-4" />
          )}
          {tersalin ? "Pesan tersalin" : "Salin pesan untuk WA"}
        </Button>
        <Button
          type="button"
          onClick={onSelesai}
          className="tekan-halus rounded-full"
        >
          Selesai
        </Button>
      </div>
    </div>
  );
}

/**
 * Tombol "Buat akun login" untuk anggota aktif yang profilnya sudah ada
 * tetapi belum bisa masuk. Hanya tampil bagi CEO/Manager (yang menerima
 * `punyaLogin`).
 */
export function TombolAkunLogin({ anggota }: { anggota: AnggotaTim }) {
  const [buka, setBuka] = useState(false);
  const [membuat, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [akun, setAkun] = useState<AkunLoginBaru | null>(null);

  if (anggota.punyaLogin !== false || anggota.status !== "aktif") return null;

  const tutup = (b: boolean) => {
    setBuka(b);
    if (!b) {
      // Kata sandi tidak boleh tertinggal di layar setelah ditutup.
      setAkun(null);
      setPesan(null);
    }
  };

  const buat = () =>
    mulai(async () => {
      setPesan(null);
      const hasil = await buatAkunLogin(anggota.id);
      if (hasil.ok) setAkun(hasil.data);
      else setPesan(hasil.pesan);
    });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setBuka(true)}
        className="tekan-halus sentuh-nyaman h-8 rounded-full px-3 text-[11px] font-semibold"
      >
        <KeyRound className="size-3.5" />
        Buat akun login
      </Button>

      <Dialog open={buka} onOpenChange={tutup}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {akun
                ? `Akun login ${anggota.nama} sudah dibuat`
                : `Buat akun login untuk ${anggota.nama}?`}
            </DialogTitle>
            <DialogDescription>
              {akun
                ? "Teruskan email dan kata sandi sementara ini kepadanya."
                : `Ia akan masuk dengan email ${anggota.email || "yang tercatat"} dan kata sandi sementara yang tampil sekali di layar berikutnya.`}
            </DialogDescription>
          </DialogHeader>

          {akun ? (
            <PanelAkunLogin akun={akun} onSelesai={() => tutup(false)} />
          ) : (
            <>
              {pesan ? (
                <p
                  role="status"
                  className="rounded-xl bg-warn-fill px-3 py-2 text-[12px] leading-[16px] text-warn-text"
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
                  disabled={membuat}
                  onClick={buat}
                  className="tekan-halus rounded-full"
                >
                  {membuat ? <Loader2 className="size-4 animate-spin" /> : null}
                  Buat akun login
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
