"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { easing, gerakAman, jagaSelesai, saatTerlihat } from "@/lib/motion";
import { daftarGsap } from "@/components/motion/gsap-init";

/**
 * Sentuhan kecil saat sebuah keadaan berubah — mis. Absen Pulang terbuka.
 * Dipicu oleh `kunci`: setiap kali nilainya berganti, isinya "menyembul".
 */
export function MunculPop({
  kunci,
  children,
  className,
}: {
  kunci: string | number | boolean;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pertama = useRef(true);
  daftarGsap();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      // Jangan animasikan render pertama — itu bukan perubahan keadaan.
      if (pertama.current) {
        pertama.current = false;
        return;
      }

      const mm = gsap.matchMedia();
      const lepas = saatTerlihat(() => {
        mm.add(gerakAman, () => {
          const gerakan = gsap.from(el, {
            scale: 0.97,
            opacity: 0.4,
            duration: 0.32,
            ease: easing.pegas,
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
    { scope: ref, dependencies: [kunci] },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
