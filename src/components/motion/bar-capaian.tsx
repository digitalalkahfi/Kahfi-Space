"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";
import { easing, gerakAman, jagaTampil, saatTerlihat } from "@/lib/motion";
import { daftarGsap } from "@/components/motion/gsap-init";

/**
 * Bar progres capaian vs target. Lebarnya dirender apa adanya di server,
 * lalu "tumbuh" dari nol saat masuk viewport bila animasi diizinkan.
 */
export function BarCapaian({
  rasio,
  label,
  warna = "bg-primary",
  tinggi = "h-2",
  penanda,
  className,
}: {
  /** 0–100. */
  rasio: number;
  label: string;
  warna?: string;
  tinggi?: string;
  /** Garis pembanding, mis. posisi capaian kemarin pada jam yang sama. */
  penanda?: { rasio: number; label: string };
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  daftarGsap();

  // Bar tidak boleh melebihi trek walau capaian di atas target.
  const lebar = Math.min(100, Math.max(0, rasio));

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      const lepas = saatTerlihat(() => {
        mm.add(gerakAman, () => {
          const gerakan = gsap.from(el, {
            scaleX: 0,
            transformOrigin: "left center",
            duration: 0.7,
            ease: easing.halus,
            scrollTrigger: { trigger: el, start: "top 95%", once: true },
          });

          return jagaTampil(el, gerakan);
        });
      });

      return () => {
        lepas();
        mm.revert();
      };
    },
    { scope: ref, dependencies: [rasio] },
  );

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-muted",
        tinggi,
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(lebar)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        ref={ref}
        className={cn("h-full rounded-full", warna)}
        style={{ width: `${lebar}%` }}
      />
      {penanda ? (
        <span
          aria-hidden
          title={penanda.label}
          className="absolute inset-y-0 w-0.5 rounded-full bg-foreground/35"
          style={{
            left: `calc(${Math.min(100, Math.max(0, penanda.rasio))}% - 1px)`,
          }}
        />
      ) : null}
    </div>
  );
}
