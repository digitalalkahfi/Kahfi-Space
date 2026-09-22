"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { easing, gerakAman, jagaSelesai, saatTerlihat } from "@/lib/motion";
import { daftarGsap } from "@/components/motion/gsap-init";

/**
 * Judul yang muncul kata demi kata. Teks utuh tetap ada di DOM
 * (tiap kata hanya dibungkus span), jadi aman untuk pembaca layar & SEO.
 */
export function TeksMuncul({
  teks,
  className,
  delay = 0.05,
}: {
  teks: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  daftarGsap();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      const lepas = saatTerlihat(() => {
        mm.add(gerakAman, () => {
          const gerakan = gsap.from(el.querySelectorAll("[data-kata]"), {
            opacity: 0,
            yPercent: 45,
            duration: 0.45,
            ease: easing.halus,
            stagger: 0.045,
            delay,
          });

          return jagaSelesai(gerakan);
        });
      });

      return () => {
        lepas();
        mm.revert();
      };
    },
    { scope: ref, dependencies: [teks] },
  );

  const kata = teks.split(" ");

  return (
    <span ref={ref} className={className}>
      {kata.map((k, i) => (
        <span
          key={`${k}-${i}`}
          className="inline-block overflow-hidden align-bottom"
        >
          <span data-kata className="inline-block">
            {k}
          </span>
          {i < kata.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}
