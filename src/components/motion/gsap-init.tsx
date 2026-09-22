"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let terdaftar = false;

/** Mendaftarkan plugin GSAP sekali untuk seluruh aplikasi. */
export function daftarGsap() {
  if (terdaftar || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ overwrite: "auto" });
  gsap.ticker.lagSmoothing(200, 33);
  terdaftar = true;
}

daftarGsap();

/**
 * Menyegarkan ScrollTrigger setelah font & gambar selesai dimuat,
 * supaya posisi trigger tidak meleset saat layout bergeser.
 */
export function GsapInit() {
  useEffect(() => {
    daftarGsap();

    const segarkan = () => ScrollTrigger.refresh();
    const idle = window.setTimeout(segarkan, 300);
    document.fonts?.ready.then(segarkan).catch(() => {});

    return () => window.clearTimeout(idle);
  }, []);

  return null;
}
