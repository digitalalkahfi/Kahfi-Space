import { cn } from "@/lib/utils";

/**
 * Garis riwayat kecil di dalam kartu KPI.
 *
 * Digambar sebagai SVG polos tanpa pustaka grafik: bentuknya sederhana,
 * dan menambah pustaka hanya untuk sepuluh garis kecil berarti menambah
 * bundel yang harus diunduh ponsel di lapangan.
 *
 * Skalanya per-KPI, bukan bersama: yang dibaca dari sparkline adalah
 * bentuk perubahannya, bukan besarannya — besarannya sudah ada di
 * angkanya sendiri.
 */
export function Sparkline({
  nilai,
  naikBaik = true,
  className,
}: {
  nilai: number[];
  /** Menentukan warna: garis yang naik belum tentu kabar baik. */
  naikBaik?: boolean;
  className?: string;
}) {
  if (nilai.length < 2) return null;

  const lebar = 64;
  const tinggi = 18;
  const min = Math.min(...nilai);
  const max = Math.max(...nilai);
  const rentang = max - min || 1;

  const titik = nilai.map((n, i) => {
    const x = (i / (nilai.length - 1)) * lebar;
    // SVG menghitung y dari atas; nilai besar harus naik ke atas.
    const y = tinggi - ((n - min) / rentang) * tinggi;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const naik = nilai.at(-1)! >= nilai[0];
  const membaik = naikBaik ? naik : !naik;

  return (
    <svg
      viewBox={`0 0 ${lebar} ${tinggi}`}
      role="img"
      aria-label={`Tren ${nilai.length} periode terakhir, ${
        naik ? "menaik" : "menurun"
      }`}
      preserveAspectRatio="none"
      className={cn("h-[18px] w-16", className)}
    >
      <polyline
        points={titik.join(" ")}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={membaik ? "stroke-ok" : "stroke-warn"}
      />
      <circle
        cx={lebar}
        cy={tinggi - ((nilai.at(-1)! - min) / rentang) * tinggi}
        r={1.8}
        className={membaik ? "fill-ok" : "fill-warn"}
      />
    </svg>
  );
}
