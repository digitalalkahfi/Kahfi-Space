import Link from "next/link";
import { ClipboardList, LockKeyhole } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { rupiahRingkas } from "@/lib/format";
import type { SasaranLaporan } from "@/lib/types";

/**
 * Keterangan kunci Absen Pulang.
 *
 * Tombol yang mati tanpa penjelasan terasa seperti aplikasi rusak. Di sini
 * disebutkan persis sasaran mana yang laporannya belum masuk, lengkap dengan
 * jalan pintas ke formulirnya.
 */
export function KunciPulang({
  belumDilapor,
}: {
  belumDilapor: SasaranLaporan[];
}) {
  const label = (s: SasaranLaporan) =>
    s.jenis === "akun" ? s.akun.username : s.nama;
  const target = (s: SasaranLaporan) =>
    s.jenis === "akun" ? s.akun.targetHarian : s.targetHarian;

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-3 px-5">
        <div className="flex items-start gap-2.5 rounded-2xl bg-warn-fill px-4 py-3">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-warn-text" />
          <div className="min-w-0">
            <p className="text-[13px] leading-[18px] font-semibold text-warn-text">
              Absen pulang masih terkunci
            </p>
            <p className="mt-0.5 text-[13px] leading-[18px] text-warn-text/90">
              {belumDilapor.length > 0
                ? "Laporan GMV hari ini belum lengkap. Kunci terbuka otomatis begitu semuanya terkirim."
                : "Laporan harian hari ini belum terkirim. Kunci terbuka otomatis setelah laporan masuk."}
            </p>
          </div>
        </div>

        {belumDilapor.length > 0 ? (
          <ul className="space-y-1.5">
            {belumDilapor.map((s) => (
              <li
                key={label(s)}
                className="baris-interaktif flex items-center gap-3 rounded-2xl bg-muted/60 px-3.5 py-2.5"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-warn-text">
                  <ClipboardList className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-[18px] font-semibold">
                    {label(s)}
                  </span>
                  <span className="tabular block text-[11px] leading-[14px] text-muted-foreground">
                    Target {rupiahRingkas(target(s))} · belum dilaporkan
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <Button
          asChild
          className="tekan-halus h-12 w-full rounded-full text-[13px] font-semibold"
        >
          <Link href="/laporan-harian">
            {belumDilapor.length === 1
              ? `Isi laporan ${label(belumDilapor[0])}`
              : "Isi Laporan Harian sekarang"}
          </Link>
        </Button>
      </div>
    </Card>
  );
}
