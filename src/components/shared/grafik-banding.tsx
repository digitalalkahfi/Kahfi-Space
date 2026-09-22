"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import {
  bagiSumbu,
  labelSumbuX,
  skalaGrafik,
  teksSatuan,
  type GarisSeri,
  type SisiSumbu,
  type SkalaGrafik,
} from "@/lib/grafik";

/**
 * Beberapa garis pada satu bingkai, untuk dibandingkan.
 *
 * Yang dijawab grafik ini bukan "bagaimana bentuk garis ini",
 * melainkan "mana yang lebih besar, dan kapan selisihnya melebar".
 * Karena itu semua garis berbagi satu bingkai, satu sumbu waktu, dan —
 * selama masuk akal — satu skala.
 *
 * Keputusan yang membuatnya jujur:
 *
 * - **Satu skala selama bisa.** Menormalkan tiap garis ke tingginya
 *   sendiri membuat lini kecil terlihat sebesar lini besar. Sumbu kedua
 *   di kanan baru muncul kalau tanpa itu salah satu garis tidak akan
 *   terlihat sama sekali — aturannya di `bagiSumbu`, dan legendanya
 *   menyebut garis mana yang membacanya.
 * - **Sumbu selalu menyentuh nol** (lihat `skalaGrafik`), supaya
 *   naik-turun kecil tidak tergambar seperti guncangan.
 * - **Tanpa area terisi.** Beberapa area bertumpuk saling menutupi dan
 *   yang terbaca justru warnanya, bukan bentuknya.
 *
 * Nilai per titik dibaca lewat sorotan: arahkan kursor, sentuh, atau
 * tekan panah kiri/kanan. Angkanya muncul di legenda — bukan di balon
 * yang mengambang dekat kursor — supaya tempat membacanya tetap sama
 * dan tidak ada yang perlu dijepit ke tepi layar ponsel.
 */
export function GrafikBanding({
  judul,
  petunjuk,
  seri,
}: {
  judul: string;
  /** Kalimat pendek yang digantikan tanggal begitu ada titik disorot. */
  petunjuk: string;
  seri: GarisSeri[];
}) {
  const [sorot, setSorot] = useState<number | null>(null);

  const panjang = seri[0]?.titik.length ?? 0;
  // Garis dengan jumlah titik berbeda akan tergambar sejajar padahal
  // tanggalnya bergeser; lebih baik tidak menggambar apa pun.
  const sepadan =
    seri.length > 0 &&
    panjang >= 2 &&
    seri.every((s) => s.titik.length === panjang);
  if (!sepadan) return null;

  const sisi = bagiSumbu(seri);
  const nilaiSisi = (s: SisiSumbu) =>
    seri.flatMap((g, i) => (sisi[i] === s ? g.titik.map((t) => t.nilai) : []));
  const skala: Record<SisiSumbu, SkalaGrafik | null> = {
    kiri: skalaGrafik(nilaiSisi("kiri")),
    kanan: sisi.includes("kanan") ? skalaGrafik(nilaiSisi("kanan")) : null,
  };
  const satuanSisi = (s: SisiSumbu) =>
    seri.find((_, i) => sisi[i] === s)?.satuan ?? "rupiah";

  const x = (i: number) => (i / (panjang - 1)) * 100;
  const y = (nilai: number, s: SisiSumbu) => {
    const sk = skala[s] ?? skala.kiri!;
    return ((sk.max - nilai) / (sk.max - sk.min || 1)) * 100;
  };

  const label = seri[0].titik.map((t) => t.label);
  // Dua kerapatan label, dipilih lewat CSS. Lebar grafik baru diketahui
  // setelah dirender, dan enam tanggal yang muat di layar laptop saling
  // menimpa pada 375px — jadi yang sempit menyiapkan versinya sendiri.
  const tandaX = {
    sempit: labelSumbuX(panjang, 4),
    lebar: labelSumbuX(panjang),
  };
  // Sorotan dijepit di sini, bukan saat disimpan: daftar titik bisa
  // berubah panjang (ganti periode) sementara sorotannya tertinggal.
  const aktif =
    sorot === null ? null : Math.min(panjang - 1, Math.max(0, sorot));
  // Tanpa sorotan, yang dibaca legenda adalah titik terakhir — periode
  // yang sedang berjalan, yang memang paling sering ditanyakan.
  const dibaca = aktif ?? panjang - 1;

  const pilihDari = (e: PointerEvent<HTMLDivElement>) => {
    const kotak = e.currentTarget.getBoundingClientRect();
    if (kotak.width === 0) return;
    const rasio = (e.clientX - kotak.left) / kotak.width;
    const i = Math.round(Math.min(1, Math.max(0, rasio)) * (panjang - 1));
    setSorot((lama) => (lama === i ? lama : i));
  };

  const geser = (arah: number) =>
    setSorot((lama) =>
      Math.min(panjang - 1, Math.max(0, (lama ?? panjang - 1) + arah)),
    );

  const padaTombol = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") geser(-1);
    else if (e.key === "ArrowRight") geser(1);
    else if (e.key === "Home") setSorot(0);
    else if (e.key === "End") setSorot(panjang - 1);
    else if (e.key === "Escape") setSorot(null);
    else return;
    e.preventDefault();
  };

  const bacaan = `${label[dibaca]}: ${seri
    .map((s) => `${s.label} ${teksSatuan(s.titik[dibaca].nilai, s.satuan)}`)
    .join(", ")}`;

  /** Label satu sisi sumbu; posisinya sama untuk kiri dan kanan. */
  const gutter = (s: SisiSumbu) => {
    const sk = skala[s];
    if (!sk) return null;
    return (
      <div
        aria-hidden
        className={cn(
          "relative h-44 w-11 shrink-0 sm:h-56 sm:w-14",
          s === "kanan" && "text-left",
        )}
      >
        {sk.tanda.map((t) => (
          <span
            key={t}
            style={{ top: `${y(t, s)}%` }}
            className={cn(
              "tabular absolute -translate-y-1/2 text-[10px] leading-[14px] text-muted-foreground",
              s === "kiri" ? "right-0" : "left-0",
            )}
          >
            {teksSatuan(t, satuanSisi(s), { prefix: false })}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-[13px] leading-[18px] font-semibold">{judul}</h3>
        <p
          className={cn(
            "tabular text-[11px] leading-[14px]",
            aktif === null
              ? "text-muted-foreground"
              : "font-semibold text-foreground",
          )}
        >
          {aktif === null ? petunjuk : label[aktif]}
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        {/* Sumbu nilai. Tanpa "Rp" di tiap baris: yang diulang tiga kali
            bukan informasi, dan satuannya sudah disebut di legendanya. */}
        {gutter("kiri")}

        <div className="min-w-0 flex-1">
          <div
            role="group"
            tabIndex={0}
            aria-label={`${judul}. Tekan panah kiri atau kanan untuk menelusuri titiknya.`}
            onPointerMove={pilihDari}
            onPointerDown={pilihDari}
            onPointerLeave={() => setSorot(null)}
            onBlur={() => setSorot(null)}
            onKeyDown={padaTombol}
            // `pan-y` supaya halaman tetap bisa digulir dengan jari di
            // atas grafik; yang diambil hanya gerakan mendatarnya.
            style={{ touchAction: "pan-y" }}
            className="relative h-44 cursor-crosshair rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-56"
          >
            {skala.kiri!.tanda.map((t) => (
              <div
                key={t}
                aria-hidden
                style={{ top: `${y(t, "kiri")}%` }}
                className={cn(
                  "absolute inset-x-0 h-px",
                  t === 0 && skala.kiri!.min < 0
                    ? "bg-border"
                    : "bg-border-subtle",
                )}
              />
            ))}

            {aktif === null ? null : (
              <div
                aria-hidden
                style={{ left: `${x(aktif)}%` }}
                className="absolute inset-y-0 w-px -translate-x-1/2 bg-foreground/25"
              />
            )}

            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="img"
              aria-label={`${judul}, ${label[0]} sampai ${label[panjang - 1]}. ${seri
                .map(
                  (s) =>
                    `${s.label} dari ${teksSatuan(s.titik[0].nilai, s.satuan)} ke ${teksSatuan(s.titik[panjang - 1].nilai, s.satuan)}`,
                )
                .join("; ")}.`}
              className="absolute inset-0 size-full overflow-visible"
            >
              {seri.map((s, i) => (
                <polyline
                  key={s.kunci}
                  points={s.titik
                    .map(
                      (t, n) =>
                        `${x(n).toFixed(2)},${y(t.nilai, sisi[i]).toFixed(2)}`,
                    )
                    .join(" ")}
                  fill="none"
                  strokeWidth={s.putus ? 1.5 : 2}
                  strokeDasharray={s.putus ? "5 4" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={s.warna}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            {/* Titiknya HTML, bukan SVG: viewBox yang diregangkan
                membuat lingkaran jadi lonjong, dan yang lonjong terbaca
                sebagai gaya, bukan sebagai penanda. */}
            {seri.map((s, i) =>
              s.putus ? null : (
                <span
                  key={`${s.kunci}-titik`}
                  aria-hidden
                  style={{
                    left: `${x(dibaca)}%`,
                    top: `${y(s.titik[dibaca].nilai, sisi[i])}%`,
                  }}
                  className={cn(
                    "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                    s.warnaLegenda,
                  )}
                />
              ),
            )}
          </div>

          {(
            [
              ["sempit", tandaX.sempit, "sm:hidden"],
              ["lebar", tandaX.lebar, "hidden sm:block"],
            ] as const
          ).map(([kunci, tanda, tampil]) => (
            <div
              key={kunci}
              aria-hidden
              className={cn("relative mt-1.5 h-4", tampil)}
            >
              {tanda.map((i) => (
                <span
                  key={i}
                  style={{
                    left: `${x(i)}%`,
                    transform:
                      i === 0
                        ? "none"
                        : i === panjang - 1
                          ? "translateX(-100%)"
                          : "translateX(-50%)",
                  }}
                  className="tabular absolute text-[10px] leading-[14px] whitespace-nowrap text-muted-foreground"
                >
                  {label[i]}
                </span>
              ))}
            </div>
          ))}
        </div>

        {gutter("kanan")}
      </div>

      {/* Legenda sekaligus pembacaan angkanya. Urutannya tetap — daftar
          yang diurutkan ulang tiap kali kursor bergeser tidak bisa
          dibaca sambil bergerak. */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {seri.map((s, i) => (
          <li
            key={`${s.kunci}-legenda`}
            className="flex items-center gap-1.5 text-[11px] leading-[14px]"
          >
            {s.putus ? (
              <span
                aria-hidden
                className="h-0 w-4 shrink-0 border-t-[1.5px] border-dashed border-muted-foreground/70"
              />
            ) : (
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", s.warnaLegenda)}
              />
            )}
            <span className="font-semibold">{s.label}</span>
            <span className="tabular text-muted-foreground">
              {teksSatuan(s.titik[dibaca].nilai, s.satuan)}
            </span>
            {/* Tanpa penanda ini, dua garis pada dua skala terbaca
                seolah-olah sama besar. */}
            {skala.kanan ? (
              <span className="rounded-full bg-muted px-1.5 text-[10px] leading-[14px] text-muted-foreground">
                {sisi[i] === "kanan" ? "sumbu kanan" : "sumbu kiri"}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="sr-only" aria-live="polite">
        {aktif === null ? "" : bacaan}
      </p>
    </div>
  );
}
