import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bilangan, persen, rupiahRingkas } from "@/lib/format";
import { perubahan, type Perubahan } from "@/lib/akun-affiliator";

const WARNA: Record<Perubahan["arah"], string> = {
  naik: "text-ok-text",
  turun: "text-danger-text",
  tetap: "text-muted-foreground",
  baru: "text-info-text",
  kosong: "text-muted-foreground",
};

type Kartu = {
  label: string;
  nilai: string;
  /** Baris kedua: perubahan vs periode lalu, atau keterangan. */
  bawah?: { teks: string; kelas: string };
};

function bandingTeks(
  sekarang: number,
  sebelumnya: number,
  pembanding: string,
): Kartu["bawah"] {
  const p = perubahan(sekarang, sebelumnya);
  return {
    teks: p.persen === null ? p.teks : `${p.teks} vs ${pembanding}`,
    kelas: WARNA[p.arah],
  };
}

/**
 * Kartu ringkasan akun (§5.2 no. 3), gaya kartu Metrik utama.
 *
 * Kartu Komisi hanya dirender bila `komisi` diberikan — halaman tidak
 * memberikannya kepada yang tidak boleh melihat komisi akun ini.
 */
export function KartuRingkasAkun({
  sekarang,
  sebelumnya,
  komisi,
  kepatuhan,
  hariLapor,
  hariKerja,
  pembanding,
}: {
  sekarang: { gmv: number; upload: number };
  sebelumnya: { gmv: number; upload: number };
  komisi: { sekarang: number; sebelumnya: number } | null;
  /** Persen 0–100; null = belum dinilai (akun tanpa level). */
  kepatuhan: number | null;
  hariLapor: number;
  hariKerja: number;
  pembanding: string;
}) {
  const kartu: Kartu[] = [
    {
      label: "GMV",
      nilai: rupiahRingkas(sekarang.gmv),
      bawah: bandingTeks(sekarang.gmv, sebelumnya.gmv, pembanding),
    },
    ...(komisi
      ? [
          {
            label: "Komisi",
            nilai: rupiahRingkas(komisi.sekarang),
            bawah: bandingTeks(komisi.sekarang, komisi.sebelumnya, pembanding),
          },
        ]
      : []),
    {
      label: "Upload",
      nilai: bilangan(sekarang.upload),
      bawah: bandingTeks(sekarang.upload, sebelumnya.upload, pembanding),
    },
    {
      label: "Kepatuhan minimum",
      nilai: kepatuhan === null ? "—" : persen(kepatuhan),
      bawah: {
        teks:
          kepatuhan === null
            ? "belum dinilai (akun tanpa level)"
            : "hari kerja yang memenuhi minimum",
        kelas: "text-muted-foreground",
      },
    },
    {
      label: "Hari lapor",
      nilai: `${hariLapor} / ${hariKerja}`,
      bawah: { teks: "lapor / hari kerja", kelas: "text-muted-foreground" },
    },
  ];

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <ul className="grid grid-cols-2 gap-2 px-5 md:grid-cols-3">
        {kartu.map((k) => (
          <li key={k.label} className="space-y-1 rounded-2xl bg-muted/50 p-3">
            <p className="text-[12px] leading-4 font-semibold">{k.label}</p>
            <p className="tabular text-[19px] leading-[26px] font-bold tracking-tight">
              {k.nilai}
            </p>
            {k.bawah ? (
              <p
                className={cn(
                  "tabular text-[11px] leading-[14px] font-semibold text-pretty",
                  k.bawah.kelas,
                )}
              >
                {k.bawah.teks}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
