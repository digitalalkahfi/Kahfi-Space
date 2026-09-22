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
import { tambahAkun } from "@/app/actions/akun";
import type { KandidatPic } from "@/lib/data/akun";
import type { KodeUnit } from "@/lib/types";

/**
 * Tambah akun affiliator baru.
 *
 * Target GMV-nya tidak diatur di sini — itu urusan Goal & roll-down,
 * supaya satu angka target hanya punya satu tempat.
 */
export function DialogTambahAkun({
  unitKode,
  unitNama,
  program,
  kandidat,
}: {
  unitKode: KodeUnit;
  unitNama: string;
  program: { id: string; nama: string }[];
  kandidat: KandidatPic[];
}) {
  const [buka, setBuka] = useState(false);
  const [username, setUsername] = useState("");
  const [programId, setProgramId] = useState<string | null>(
    program.find((p) => p.nama === "Reguler")?.id ?? program[0]?.id ?? null,
  );
  const [picId, setPicId] = useState<string | null>(null);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const siap = /^@[a-z0-9._]{3,30}$/i.test(username.trim());

  const simpan = () => {
    if (!siap || menyimpan) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await tambahAkun({
        username: username.trim(),
        unitKode,
        programId,
        picId,
      });

      if (hasil.ok || hasil.kode === "demo") {
        setUsername("");
        setPicId(null);
        setBuka(false);
        if (!hasil.ok) setPesan(hasil.pesan);
        return;
      }
      setPesan(hasil.pesan);
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
          Tambah akun
        </Button>
      </DialogTrigger>

      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah akun {unitNama}</DialogTitle>
          <DialogDescription>
            Targetnya diatur belakangan di Goal &amp; roll-down.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="username-akun"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Username akun
            </label>
            <input
              id="username-akun"
              value={username}
              maxLength={31}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@nama_toko"
              className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              Diawali @, 3–30 huruf, angka, titik, atau garis bawah.
            </p>
          </div>

          {program.length > 0 ? (
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] leading-[18px] font-semibold">
                Program
              </legend>
              <div className="flex flex-wrap gap-1">
                {program.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProgramId(p.id)}
                    aria-pressed={p.id === programId}
                    className={cn(
                      "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                      p.id === programId
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.nama}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              PIC{" "}
              <span className="font-normal text-muted-foreground">
                (bisa ditunjuk nanti)
              </span>
            </legend>
            <div className="max-h-44 space-y-1 overflow-y-auto">
              {kandidat.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setPicId(picId === k.id ? null : k.id)}
                  aria-pressed={picId === k.id}
                  className={cn(
                    "baris-interaktif flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left",
                    picId === k.id
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "bg-muted/50",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] font-medium">
                    {k.nama}
                  </span>
                  <span className="shrink-0 text-[11px] leading-[14px] text-muted-foreground">
                    {k.jumlahAkun === 0
                      ? "belum pegang akun"
                      : `${k.jumlahAkun} akun`}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

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
            {menyimpan ? "Menyimpan…" : "Simpan akun"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
