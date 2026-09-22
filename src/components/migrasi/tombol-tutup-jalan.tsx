"use client";

import { useState, useTransition } from "react";
import { Loader2, SquareCheckBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tutupMigrasi } from "@/app/actions/migrasi";

/**
 * Menutup jalan migrasi yang tersangkut terbuka.
 *
 * Hanya satu jalan boleh terbuka pada satu waktu, jadi percobaan yang
 * terputus di tengah harus bisa ditutup dari layar — kalau tidak, migrasi
 * berikutnya tidak akan pernah bisa dimulai.
 */
export function TombolTutupJalan({ jalanId }: { jalanId: string }) {
  const [menutup, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const tutup = () => {
    if (menutup) return;
    setPesan(null);
    mulai(async () => {
      const hasil = await tutupMigrasi(jalanId);
      setPesan(hasil.pesan ?? null);
    });
  };

  return (
    <div className="mx-5 space-y-1.5">
      <Button
        type="button"
        variant="outline"
        disabled={menutup}
        onClick={tutup}
        className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
      >
        {menutup ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <SquareCheckBig className="size-3.5" />
        )}
        Tutup jalan ini
      </Button>
      <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
        {pesan ??
          "Selama jalan ini terbuka, migrasi berikutnya tidak bisa dimulai."}
      </p>
    </div>
  );
}
