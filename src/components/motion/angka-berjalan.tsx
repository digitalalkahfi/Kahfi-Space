"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  durasi,
  easing,
  gerakAman,
  jagaTampil,
  saatTerlihat,
} from "@/lib/motion";
import { daftarGsap } from "@/components/motion/gsap-init";
import { persen, rupiahRingkas } from "@/lib/format";

type Format = "rupiah" | "persen" | "angka";

/**
 * Angka yang naik dari nol saat masuk viewport.
 * Nilai akhir sudah dirender di HTML, jadi tanpa JS angkanya tetap benar.
 * Format dipilih lewat prop (bukan fungsi) agar bisa dipakai dari server component.
 */
export function AngkaBerjalan({
  nilai,
  format = "rupiah",
  digit = 2,
  pangkas = false,
  className,
}: {
  nilai: number;
  format?: Format;
  digit?: number;
  pangkas?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  daftarGsap();

  const tulis = (n: number) => {
    if (format === "persen") return persen(n, digit);
    if (format === "angka")
      return n.toLocaleString("id-ID", { maximumFractionDigits: digit });
    return rupiahRingkas(n, { digit, pangkas });
  };

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      const lepas = saatTerlihat(() => {
        mm.add(gerakAman, () => {
          const penghitung = { n: 0 };
          const gerakan = gsap.to(penghitung, {
            n: nilai,
            duration: durasi.angka,
            ease: easing.halus,
            onUpdate: () => {
              el.textContent = tulis(penghitung.n);
            },
            onComplete: () => {
              el.textContent = tulis(nilai);
            },
            scrollTrigger: { trigger: el, start: "top 92%", once: true },
          });

          return jagaTampil(el, gerakan);
        });
      });

      return () => {
        lepas();
        mm.revert();
      };
    },
    { scope: ref, dependencies: [nilai, format, digit, pangkas] },
  );

  return (
    <span ref={ref} className={className}>
      {tulis(nilai)}
    </span>
  );
}
