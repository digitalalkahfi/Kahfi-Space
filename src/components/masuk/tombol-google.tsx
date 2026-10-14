"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { klienBrowser } from "@/lib/supabase/client";

/** Logo "G" Google, satu warna mengikuti teks tombol. */
function LogoGoogle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="currentColor">
      <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z" />
    </svg>
  );
}

/**
 * "Masuk dengan Google" (/masuk) atau "Sambungkan Google" (/profil).
 *
 * Mode `sambung` memakai `linkIdentity`: Google ditempelkan ke akun yang
 * sedang login, bukan membuat akun baru — riwayatnya tetap satu (jalur B
 * di docs/DAFTAR-GOOGLE-PERSETUJUAN.md).
 */
export function TombolGoogle({
  mode,
  lanjut,
}: {
  mode: "masuk" | "sambung";
  lanjut: string;
}) {
  const [menunggu, setMenunggu] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  const mulai = async () => {
    setMenunggu(true);
    setPesan(null);
    const sb = klienBrowser();
    const redirectTo = `${window.location.origin}/auth/callback?lanjut=${encodeURIComponent(lanjut)}`;
    const { error } =
      mode === "masuk"
        ? await sb.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo, queryParams: { prompt: "select_account" } },
          })
        : await sb.auth.linkIdentity({
            provider: "google",
            options: { redirectTo, queryParams: { prompt: "select_account" } },
          });
    // Berhasil berarti peramban sedang dialihkan ke Google.
    if (error) {
      setPesan(error.message);
      setMenunggu(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={menunggu}
        onClick={mulai}
        className="tekan-halus sentuh-nyaman h-12 w-full rounded-full text-[13px] font-semibold"
      >
        {menunggu ? <Loader2 className="size-4 animate-spin" /> : <LogoGoogle />}
        {mode === "masuk" ? "Masuk dengan Google" : "Sambungkan Google"}
      </Button>
      {pesan ? (
        <p
          role="alert"
          className="rounded-xl bg-danger-fill px-3 py-2 text-[11px] leading-[14px] text-danger-text"
        >
          {pesan}
        </p>
      ) : null}
    </div>
  );
}
