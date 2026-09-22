import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { GsapInit } from "@/components/motion/gsap-init";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

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
