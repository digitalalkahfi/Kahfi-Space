"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, PlugZap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { klienBrowser } from "@/lib/supabase/client";
import { modeData } from "@/lib/supabase/config";

type Sambungan = "menyambung" | "tersambung" | "terputus";

/**
 * Memunculkan notifikasi baru tanpa memuat ulang halaman.
 *
 * Menumpang kanal realtime Supabase yang sudah dipakai kalender — tidak
 * ada mekanisme baru, tidak ada polling. Yang berubah hanya tabel yang
 * didengarkan.
 *
 * Halaman tidak melompat sendiri: yang muncul hanya penanda kecil, dan
 * penyegarannya dikerjakan `router.refresh()` yang mempertahankan
 * posisi gulir serta isian yang sedang diketik.
 *
 * Yang paling penting di sini justru bukan jalur bahagianya, melainkan
 * saat sambungan putus. Realtime yang diam-diam mati adalah keadaan
 * paling berbahaya dari pusat notifikasi: layarnya terlihat normal,
 * orangnya merasa sedang memantau, padahal tidak ada lagi yang masuk.
 * Karena itu putusnya SELALU ditampilkan, lengkap dengan cara keluar.
 */
export function SinkronNotifikasi() {
  const router = useRouter();
  const [baru, setBaru] = useState(0);
  const [sambungan, setSambungan] = useState<Sambungan>("menyambung");

  useEffect(() => {
    // Mode demo tidak punya server realtime; berlangganan di sana hanya
    // menghasilkan sambungan yang gagal berulang-ulang di konsol.
    if (modeData() !== "supabase") return;

    const sb = klienBrowser();
    const saluran = sb
      .channel("notifikasi-saya")
      .on(
        "postgres_changes",
        // Hanya INSERT: perubahan status dibaca datang dari tindakan
        // orangnya sendiri, dan halamannya sudah disegarkan di sana.
        { event: "INSERT", schema: "public", table: "notifications" },
        () => {
          setBaru((n) => n + 1);
          router.refresh();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSambungan((sebelum) => {
            // Baru pulih setelah sempat putus: apa pun yang terbit
            // selama putus tidak pernah sampai, jadi daftarnya ditarik
            // ulang sekali. Tanpa ini, notifikasi yang lahir saat
            // sinyal hilang tidak akan pernah muncul.
            if (sebelum === "terputus") router.refresh();
            return "tersambung";
          });
          return;
        }
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setSambungan("terputus");
        }
      });

    return () => {
      void sb.removeChannel(saluran);
    };
  }, [router]);

  useEffect(() => {
    if (baru === 0) return;
    const jeda = setTimeout(() => setBaru(0), 5000);
    return () => clearTimeout(jeda);
  }, [baru]);

  if (sambungan === "terputus") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-warn-fill px-4 py-2.5 text-warn-text">
        <p
          role="status"
          className="flex items-center gap-2 text-[13px] leading-[18px] text-pretty"
        >
          <PlugZap className="size-4 shrink-0" />
          Pembaruan langsung terputus — notifikasi baru tidak akan muncul
          sendiri sampai tersambung lagi.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.refresh()}
          className="tekan-halus sentuh-nyaman h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold"
        >
          <RefreshCw className="size-3" />
          Muat ulang
        </Button>
      </div>
    );
  }

  if (baru === 0) return null;

  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-2xl bg-info-fill px-4 py-2.5 text-[13px] leading-[18px] text-pretty text-info-text"
    >
      <BellRing className="size-4 shrink-0" />
      {baru === 1
        ? "Satu notifikasi baru masuk."
        : `${baru} notifikasi baru masuk.`}
    </p>
  );
}
