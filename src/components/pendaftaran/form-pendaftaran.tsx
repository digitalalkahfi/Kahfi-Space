"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isiPendaftaran } from "@/app/actions/pendaftaran";
import { CATATAN_DAFTAR_MAKS, PILIHAN_UNIT_DAFTAR } from "@/lib/pendaftaran";

/** Form data tambahan calon anggota di /menunggu (D4). */
export function FormPendaftaran({
  awal,
  onSelesai,
}: {
  awal?: { noWa: string | null; unitDiajukan: string | null; catatan: string | null };
  onSelesai?: () => void;
}) {
  const [noWa, setNoWa] = useState(awal?.noWa ?? "");
  const [unit, setUnit] = useState<string | null>(awal?.unitDiajukan ?? null);
  const [catatan, setCatatan] = useState(awal?.catatan ?? "");
  const [pesan, setPesan] = useState<string | null>(null);
  const [mengirim, mulai] = useTransition();

  const kirim = () =>
    mulai(async () => {
      setPesan(null);
      const hasil = await isiPendaftaran({ noWa, unitDiajukan: unit, catatan });
      if (!hasil.ok) {
        setPesan(hasil.pesan);
        return;
      }
      onSelesai?.();
    });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        kirim();
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="no-wa" className="text-[13px] leading-[18px] font-semibold">
          Nomor WhatsApp
        </label>
        <input
          id="no-wa"
          type="tel"
          inputMode="tel"
          required
          autoComplete="tel"
          value={noWa}
          onChange={(e) => setNoWa(e.target.value)}
          placeholder="0812 3456 7890"
          className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <p className="text-[11px] leading-[14px] text-muted-foreground">
          Manager atau CEO memakai nomor ini untuk memastikan bahwa ini memang
          kamu sebelum menyetujui.
        </p>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-[13px] leading-[18px] font-semibold">
          Divisi yang kamu ajukan{" "}
          <span className="font-normal text-muted-foreground">(opsional)</span>
        </legend>
        <div className="flex flex-wrap gap-1">
          {PILIHAN_UNIT_DAFTAR.map((u) => (
            <button
              key={u.kode}
              type="button"
              aria-pressed={unit === u.kode}
              onClick={() => setUnit(unit === u.kode ? null : u.kode)}
              className={cn(
                "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                unit === u.kode
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {u.nama}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-[14px] text-muted-foreground">
          Ini hanya pengajuan. Penempatanmu ditetapkan saat disetujui.
        </p>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="catatan-daftar" className="text-[13px] leading-[18px] font-semibold">
          Catatan{" "}
          <span className="font-normal text-muted-foreground">(opsional)</span>
        </label>
        <textarea
          id="catatan-daftar"
          value={catatan}
          maxLength={CATATAN_DAFTAR_MAKS}
          rows={3}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Mis. direkrut oleh Bu Dewi untuk tim Affiliator"
          className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      {pesan ? (
        <p
          role="alert"
          className="rounded-xl bg-danger-fill px-3 py-2 text-[11px] leading-[14px] text-danger-text"
        >
          {pesan}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={mengirim || noWa.trim().length === 0}
        className="tekan-halus sentuh-nyaman h-12 w-full rounded-full text-[13px] font-semibold"
      >
        {mengirim ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {mengirim ? "Mengirim…" : "Kirim pendaftaran"}
      </Button>
    </form>
  );
}
