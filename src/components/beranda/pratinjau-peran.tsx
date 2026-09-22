"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Peran } from "@/lib/types";

/**
 * Pemilih peran untuk mencoba dasbor tiap jabatan — hanya tampil di mode
 * demo (lihat src/app/beranda/page.tsx). Di mode Supabase peran datang
 * dari sesi pengguna dan parameter `persona` diabaikan lapisan data, jadi
 * tombol ini tidak akan mengubah apa pun di sana.
 */
export function PratinjauPeran({
  daftar,
  aktif,
}: {
  daftar: Peran[];
  aktif: Peran;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const pindah = (peran: Peran) => {
    const baru = new URLSearchParams(params.toString());
    baru.set("persona", peran);
    router.replace(`/beranda?${baru.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border-subtle bg-card/60 px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] leading-[14px] font-semibold text-muted-foreground">
        <UserCog className="size-3.5" />
        Pratinjau peran
      </span>
      <div className="flex flex-wrap gap-1">
        {daftar.map((peran) => (
          <button
            key={peran}
            type="button"
            onClick={() => pindah(peran)}
            aria-pressed={peran === aktif}
            className={cn(
              "tekan-halus sentuh-nyaman rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
              peran === aktif
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {peran}
          </button>
        ))}
      </div>
    </div>
  );
}
