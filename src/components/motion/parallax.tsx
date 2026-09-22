"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { gerakAman, saatTerlihat } from "@/lib/motion";
import { daftarGsap } from "@/components/motion/gsap-init";

/**
 * Parallax ringan: elemen bergerak beberapa piksel lebih lambat dari scroll.
 * Sengaja kecil (maks ~24px) agar tidak mengganggu keterbacaan angka GMV.
 */
export function Parallax({
  children,
  className,
  jarak = 18,
}: {
  children: ReactNode;
  className?: string;
  /** Simpangan maksimum dalam piksel. */
  jarak?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  daftarGsap();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      const lepas = saatTerlihat(() => {
        // Hanya di layar yang cukup lebar — di HP scroll harus terasa "menempel".
        mm.add(`${gerakAman} and (min-width: 768px)`, () => {
          gsap.fromTo(
            el,
            { y: jarak },
            {
              y: -jarak,
              ease: "none",
              scrollTrigger: {
                trigger: el,
                start: "top bottom",
                end: "bottom top",
                scrub: 0.6,
              },
            },
          );
        });
      });

      return () => {
        lepas();
        mm.revert();
      };
    },
    { scope: ref, dependencies: [jarak] },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
