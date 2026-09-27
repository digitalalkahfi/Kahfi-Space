import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { GsapInit } from "@/components/motion/gsap-init";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Fungsi server dijalankan di Singapura, satu wilayah dengan proyek
 * Supabase (ap-southeast-1). Tanpa ini Vercel menaruhnya di iad1
 * (Amerika), dan setiap halaman — yang butuh 8–10 permintaan berurutan
 * ke basis data — membayar ±300 ms perjalanan lintas Pasifik per
 * permintaan: terukur 3–4 detik per klik. `vercel.json` menyatakan hal
 * yang sama untuk seluruh proyek; keduanya harus tetap sama.
 */
export const preferredRegion = "sin1";

export const metadata: Metadata = {
  title: "K-Space V2 — Al-Kahfi Corp",
  description:
    "Satu tempat untuk absensi, tugas, laporan harian GMV, dan GRD tim Al-Kahfi Corp.",
};

export const viewport: Viewport = {
  themeColor: "#f4f5f9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full`}>
      <body className="min-h-full">
        <GsapInit />
        {children}
      </body>
    </html>
  );
}
