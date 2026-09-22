"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { easing, gerakAman, jagaTampil, saatTerlihat } from "@/lib/motion";
import { daftarGsap } from "@/components/motion/gsap-init";
import { persen } from "@/lib/format";

export type SegmenDonut = {
  kunci: string;
  panjang: number;
  offset: number;
  garis: string;
};

/**
 * Donut capaian bulanan. Busur digambar penuh di server; saat masuk viewport
 * tiap segmen "tumbuh" berurutan dan persentasenya ikut naik dari nol.
 */
export function DonutCapaian({
  segmen,
  keliling,
  radius,
  capaian,
}: {
  segmen: SegmenDonut[];
  keliling: number;
  radius: number;
  /** 0–100. */
  capaian: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  daftarGsap();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      const lepas = saatTerlihat(() => {
        mm.add(gerakAman, () => {
          const busur = el.querySelectorAll<SVGCircleElement>("[data-busur]");
          const angka = el.querySelector<HTMLElement>("[data-angka]");

          const tl = gsap.timeline({
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          });

          busur.forEach((b) => {
            const panjang = Number(b.dataset.panjang ?? 0);
            tl.fromTo(
              b,
              { strokeDasharray: `0 ${keliling}` },
              {
                strokeDasharray: `${panjang} ${keliling - panjang}`,
                duration: 0.5,
                ease: easing.halus,
              },
              "<0.12",
            );
          });

          const pengaman = jagaTampil(el, tl);

          if (angka) {
            const hitung = { n: 0 };
            tl.to(
              hitung,
              {
                n: capaian,
                duration: 0.8,
                ease: easing.halus,
                onUpdate: () => {
                  angka.textContent = persen(hitung.n, 0);
                },
                onComplete: () => {
                  angka.textContent = persen(capaian, 0);
                },
              },
              0,
            );
          }

          return pengaman;
        });
      });

      return () => {
        lepas();
        mm.revert();
      };
    },
    { scope: ref, dependencies: [capaian, keliling] },
  );

  return (
    <div ref={ref} className="relative shrink-0">
      <svg
        viewBox="0 0 128 128"
        className="size-32 -rotate-90"
        role="img"
        aria-label={`${persen(capaian, 0)} dari target bulanan tercapai`}
      >
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="14"
          className="stroke-muted"
        />
        {segmen.map((s) => (
          <circle
            key={s.kunci}
            data-busur
            data-panjang={s.panjang}
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            strokeWidth="14"
            strokeLinecap="butt"
            className={s.garis}
            strokeDasharray={`${s.panjang} ${keliling - s.panjang}`}
            strokeDashoffset={-s.offset}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span
          data-angka
          className="tabular text-2xl leading-[30px] font-bold tracking-tight"
        >
          {persen(capaian, 0)}
        </span>
        <span className="text-[11px] leading-[14px] text-muted-foreground">
          Tercapai
        </span>
      </div>
    </div>
  );
}
