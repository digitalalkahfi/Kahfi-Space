"use client";

import { bilangan } from "@/lib/format";
import { ringkasanUnggahan, type RingkasUnggah } from "@/lib/ekspor-v1";

/**
 * Ringkasan satu kali unggah, dalam empat angka.
 *
 * Angka yang paling menentukan bukan "berapa yang masuk" melainkan
 * "berapa yang tidak" — kunci yang dilewatkan adalah data lama yang tidak
 * akan pernah muncul di sistem baru, dan itu harus terbaca sekarang,
 * bukan setelah sistem lama dimatikan.
 */
export function RingkasanUnggahan({ ringkas }: { ringkas: RingkasUnggah }) {
  const r = ringkasanUnggahan(ringkas.baris);

  const angka: { label: string; nilai: string; keterangan: string }[] = [
    {
      label: "Kunci tersimpan",
      nilai: `${r.kunciDisimpan}/${r.kunci}`,
      keterangan: `${bilangan(r.entriDisimpan)} entri`,
    },
    {
      label: "Kunci dilewatkan",
      nilai: String(r.kunciDilewati),
      keterangan: `${bilangan(r.entriDilewati)} entri`,
    },
    {
      label: "Belum dikenali",
      nilai: String(r.kunciAsing),
      keterangan: r.kunciAsing > 0 ? "menunggu keputusan" : "tidak ada",
    },
    {
      label: "Seluruh entri",
      nilai: bilangan(r.entri),
      keterangan: `dari ${r.kunci} kunci`,
    },
  ];

  const meta = ringkas.meta;
  const keterangan = meta
    ? [
        { medan: "Versi aplikasi lama", nilai: meta.versi },
        { medan: "Diekspor pada", nilai: meta.diekspor },
        { medan: "Diekspor oleh", nilai: meta.oleh },
        { medan: "Sumber", nilai: meta.sumber },
        ...meta.lainnya,
      ].filter((k): k is { medan: string; nilai: string } => Boolean(k.nilai))
    : [];

  return (
    <>
      <dl className="mx-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {angka.map((a) => (
          <div key={a.label} className="rounded-2xl bg-muted px-4 py-3">
            <dt className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              {a.label}
            </dt>
            <dd className="tabular text-[22px] leading-7 font-bold tracking-tight">
              {a.nilai}
            </dd>
            <dd className="text-[11px] leading-[14px] text-muted-foreground">
              {a.keterangan}
            </dd>
          </div>
        ))}
      </dl>

      {keterangan.length > 0 ? (
        <div className="mx-5 rounded-2xl bg-muted px-4 py-3">
          <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Keterangan ekspor
          </p>
          <dl className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {keterangan.map((k) => (
              <div key={k.medan} className="flex flex-wrap gap-x-2">
                <dt className="text-[11px] leading-[16px] text-muted-foreground">
                  {k.medan}
                </dt>
                <dd className="text-[11px] leading-[16px] font-semibold break-all">
                  {k.nilai}
                </dd>
              </div>
            ))}
          </dl>
          {meta?.diekspor ? (
            <p className="mt-1.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
              Bandingkan waktu ekspor ini dengan kapan K-Space lama dibekukan.
              Ekspor yang diambil sebelum orang berhenti memakainya akan
              kekurangan baris, dan selisihnya baru terlihat di layar
              verifikasi.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
