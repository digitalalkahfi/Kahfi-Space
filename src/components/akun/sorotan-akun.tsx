import { Card } from "@/components/ui/card";
import { rupiahRingkas, tanggalKalenderPendek } from "@/lib/format";
import type { SorotanAkun as Sorotan } from "@/lib/detail-akun";

/**
 * Sorotan singkat (§5.2 no. 5): tiga kalimat yang dihitung dari angka
 * yang sudah ada, tanpa AI.
 */
export function SorotanAkun({
  sorotan,
  acuan,
}: {
  sorotan: Sorotan;
  /** Tanggal acuan; tahun hanya ditulis bila berbeda dengannya. */
  acuan: string;
}) {
  const butir: { label: string; nilai: string }[] = [
    {
      label: "GMV tertinggi",
      nilai: sorotan.tertinggi
        ? `${rupiahRingkas(sorotan.tertinggi.gmv)} · ${tanggalKalenderPendek(sorotan.tertinggi.tanggal, acuan)}`
        : "—",
    },
    {
      label: "Rata-rata GMV per hari lapor",
      nilai:
        sorotan.rataPerHariLapor === null
          ? "—"
          : rupiahRingkas(sorotan.rataPerHariLapor),
    },
    {
      label: "Hari kerja di bawah minimum",
      nilai:
        sorotan.hariDiBawahMinimum === null
          ? "belum dinilai (akun tanpa level)"
          : `${sorotan.hariDiBawahMinimum} hari`,
    },
  ];

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-2 px-5">
        <h2 className="text-[15px] leading-5 font-semibold">Sorotan</h2>
        <ul className="grid gap-2 sm:grid-cols-3">
          {butir.map((b) => (
            <li
              key={b.label}
              className="space-y-0.5 rounded-2xl bg-muted/50 p-3"
            >
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                {b.label}
              </p>
              <p className="tabular text-[13px] leading-[18px] font-semibold">
                {b.nilai}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
