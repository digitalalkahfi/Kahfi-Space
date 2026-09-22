"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PetunjukSandi } from "@/components/profil/petunjuk-sandi";

/**
 * Kotak untuk mencoba sebuah sandi tanpa menggantinya.
 *
 * Tidak ada tombol simpan dan tidak ada yang dikirim: apa yang diketik
 * hanya diperiksa di perangkat ini. Ada supaya orang tidak harus gagal
 * dulu di form ganti sandi untuk tahu sandinya kurang apa.
 */
export function CobaSandi({ nama, email }: { nama?: string; email?: string }) {
  const [sandi, setSandi] = useState("");
  const [terlihat, setTerlihat] = useState(false);

  return (
    <div className="space-y-2">
      <label
        htmlFor="coba-sandi"
        className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
      >
        Coba sebuah sandi
      </label>

      <div className="flex gap-2">
        <Input
          id="coba-sandi"
          type={terlihat ? "text" : "password"}
          value={sandi}
          autoComplete="off"
          onChange={(e) => setSandi(e.target.value)}
          placeholder="Ketik untuk melihat mana yang sudah terpenuhi"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          aria-label={terlihat ? "Sembunyikan sandi" : "Tampilkan sandi"}
          aria-pressed={terlihat}
          onClick={() => setTerlihat((t) => !t)}
          className="tekan-halus sentuh-nyaman size-9 shrink-0 rounded-full p-0"
        >
          {terlihat ? (
            <EyeOff className="size-3.5" />
          ) : (
            <Eye className="size-3.5" />
          )}
        </Button>
      </div>

      <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
        Tidak dikirim ke mana pun dan tidak mengubah sandimu — pemeriksaannya
        berjalan di perangkat ini saja.
      </p>

      <PetunjukSandi sandi={sandi} konteks={{ nama, email }} />
    </div>
  );
}
