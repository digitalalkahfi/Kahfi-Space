"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";
import {
  durasi,
  easing,
  gerakAman,
  jagaTampil,
  jedaStagger,
  saatTerlihat,
} from "@/lib/motion";
import { daftarGsap } from "@/components/motion/gsap-init";

type Varian = "naik" | "samping" | "skala" | "pudar";

const geser: Record<Varian, gsap.TweenVars> = {
  naik: { y: 22 },
  samping: { x: 22 },
  skala: { scale: 0.96 },
  pudar: {},
};

/**
 * Menyingkap elemen saat masuk viewport (fade + slide/scale halus).
 * Konten tetap dirender server; pembungkus ini hanya mengatur geraknya,
 * dan tanpa JS/dengan reduced-motion isinya langsung terlihat penuh.
 */
export function Reveal({
  children,
  className,
  varian = "naik",
  delay = 0,
  as: Tag = "div",
  stagger = false,
}: {
  children: ReactNode;
  className?: string;
  varian?: Varian;
  delay?: number;
  as?: ElementType;
  /** Animasikan anak-anak langsung satu per satu, bukan blok utuh. */
  stagger?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  daftarGsap();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      const lepas = saatTerlihat(() => {
        mm.add(gerakAman, () => {
          const sasaran = stagger ? Array.from(el.children) : el;
          if (stagger && (sasaran as Element[]).length === 0) return;

          const gerakan = gsap.from(sasaran, {
            opacity: 0,
            ...geser[varian],
            duration: durasi.cepat,
            ease: easing.halus,
            delay,
            stagger: stagger ? jedaStagger : 0,
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              once: true,
            },
          });

          return jagaTampil(el, gerakan);
        });
      });

      return () => {
        lepas();
        mm.revert();
      };
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/** Varian ringkas untuk membungkus satu kartu. */
export function RevealKartu({
  children,
  className,
  delay,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal varian="naik" delay={delay} className={cn(className)}>
      {children}
    </Reveal>
  );
}
