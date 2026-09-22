import { ClipboardX, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { persen } from "@/lib/format";

/**
 * Ringkasan angka kehadiran & laporan hari ini.
 * Tindak lanjut per orang ada di kartu Pantau Kehadiran.
 */
export function StatusTim({
  totalStaf,
  sudahAbsen,
  wajibLapor,
  sudahLapor,
}: {
  totalStaf: number;
  sudahAbsen: number;
  /** Penyebut laporan: hanya PIC akun & Leader unit yang wajib lapor. */
  wajibLapor: number;
  sudahLapor: number;
}) {
  const rasio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  const laporanLengkap = wajibLapor > 0 && sudahLapor >= wajibLapor;

  const metrik = [
    {
      label: "Kehadiran",
      nilai: sudahAbsen,
      dari: totalStaf,
      icon: ShieldCheck,
      catatan: `${persen(rasio(sudahAbsen, totalStaf), 0)} sudah check-in`,
      kelas: "bg-ok-fill",
      teks: "text-ok-text",
    },
    {
      label: "Laporan GMV",
      nilai: sudahLapor,
      dari: wajibLapor,
      icon: ClipboardX,
      catatan:
        wajibLapor === 0
          ? "Tidak ada sasaran lapor"
          : `${persen(rasio(sudahLapor, wajibLapor), 0)} sasaran terkirim`,
      kelas: laporanLengkap ? "bg-ok-fill" : "bg-warn-fill",
      teks: laporanLengkap ? "text-ok-text" : "text-warn-text",
    },
  ];

  return (
    <Card className="kartu-interaktif ring-border-subtle rounded-3xl shadow-card">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Status Tim Hari Ini
        </h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          Total {totalStaf} staf lapangan &amp; admin
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5">
        {metrik.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className={cn("baris-interaktif rounded-2xl p-3.5", m.kelas)}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "text-[13px] leading-[18px] font-semibold",
                    m.teks,
                  )}
                >
                  {m.label}
                </span>
                <Icon className={cn("size-4 shrink-0", m.teks)} />
              </div>
              <p className="mt-2 flex items-baseline gap-0.5">
                <span className="tabular text-2xl leading-[30px] font-bold tracking-tight">
                  {m.nilai}
                </span>
                <span className="tabular text-[13px] leading-[18px] text-muted-foreground">
                  /{m.dari}
                </span>
              </p>
              <p
                className={cn(
                  "mt-1 text-[11px] leading-[14px] font-medium",
                  m.teks,
                )}
              >
                {m.catatan}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
