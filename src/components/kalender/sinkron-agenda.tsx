"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { klienBrowser } from "@/lib/supabase/client";

/**
 * Menyegarkan kalender saat agenda berubah di tempat lain.
 *
 * Rapat yang digeser setengah jam sebelum mulai adalah kejadian paling
 * lazim sekaligus paling merugikan bila terlambat diketahui — dan orang
 * biasanya sedang membuka halaman ini justru pada saat itu.
 *
 * Halaman tidak berpindah sendiri: yang muncul hanya penanda kecil, dan
 * penyegarannya dikerjakan `router.refresh()` yang mempertahankan posisi
 * gulir serta isian yang sedang diketik.
 */
export function SinkronAgenda() {
  const router = useRouter();
  const [baru, setBaru] = useState(false);

  useEffect(() => {
    const sb = klienBrowser();

    const saluran = sb
      .channel("agenda-bersama")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agenda" },
        () => {
          setBaru(true);
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(saluran);
    };
  }, [router]);

  useEffect(() => {
    if (!baru) return;
    const jeda = setTimeout(() => setBaru(false), 4000);
    return () => clearTimeout(jeda);
  }, [baru]);

  if (!baru) return null;

  return (
    <p
      role="status"
      className="flex items-center gap-1.5 rounded-full bg-info-fill px-3 py-1.5 text-[11px] leading-[14px] font-semibold text-info-text"
    >
      <RefreshCw className="size-3" />
      Kalender baru saja diperbarui
    </p>
  );
}
