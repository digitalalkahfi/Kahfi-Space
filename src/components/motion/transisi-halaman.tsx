"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  durasi,
  easing,
  gerakAman,
  jagaSelesai,
  saatTerlihat,
} from "@/lib/motion";
import { daftarGsap } from "@/components/motion/gsap-init";

/**
 * Transisi antar menu: konten baru naik & memudar masuk.
 * Dipasang lewat app/template.tsx sehingga ikut ter-mount tiap pindah rute.
 */
export function TransisiHalaman({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  daftarGsap();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      const lepas = saatTerlihat(() => {
        mm.add(gerakAman, () => {
          const gerakan = gsap.from(el, {
            opacity: 0,
            y: 12,
            duration: durasi.cepat,
            ease: easing.keluar,
            clearProps: "opacity,transform",
          });

          return jagaSelesai(gerakan, 1500);
        });
      });

      return () => {
        lepas();
        mm.revert();
      };
    },
    { scope: ref },
  );

  return <div ref={ref}>{children}</div>;
}
