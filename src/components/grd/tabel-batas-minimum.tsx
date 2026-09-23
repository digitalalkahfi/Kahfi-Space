import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bilangan } from "@/lib/format";
import type { SebaranLevel } from "@/lib/data/kepatuhan";

/**
 * Tabel acuan level → batas minimum unggahan.
 *
 * Satu-satunya tempat angka ini boleh dibaca manusia. Kolom "dipakai"
 * ada karena pertanyaan pertama saat hendak mengubah sebuah batas selalu
 * "ini kena berapa akun" — tanpa itu, perubahan dilakukan sambil menebak.
 */
export function TabelBatasMinimum({ baris }: { baris: SebaranLevel[] }) {
  const terpakai = baris.reduce((a, b) => a + b.akun, 0);

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-1 px-5">
        <h2 className="text-base leading-6 font-semibold">
          Acuan batas minimum
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Angka ini dipakai form laporan, riwayat, rekap, dan mesin kepatuhan.
          Mengubah satu baris mengubah standar seluruh akun di level itu —{" "}
          {terpakai} akun aktif sedang memakai acuan ini.
        </p>
      </div>

      <div className="overflow-x-auto px-5">
        <table className="w-full min-w-[26rem] border-collapse text-[13px] leading-[18px]">
          <caption className="sr-only">
            Batas minimum unggahan per hari kerja untuk tiap level akun
          </caption>
          <thead>
            <tr className="border-b border-border-subtle text-left">
              {["Level", "Minimum / hari kerja", "Dipakai"].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    "py-2 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase",
                    i === 0 ? "pr-3" : "pr-3 text-right",
                    i === 2 && "pr-0",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr
                key={b.level}
                className={cn(
                  "border-b border-border-subtle last:border-0",
                  // Level yang tidak dipakai siapa pun sengaja diredupkan:
                  // mengubahnya tidak berakibat apa-apa hari ini.
                  b.akun === 0 && "text-muted-foreground",
                )}
              >
                <th scope="row" className="py-2 pr-3 text-left font-semibold">
                  Level {b.level}
                  {b.contoh.length > 0 ? (
                    <span className="block truncate text-[11px] leading-[14px] font-normal text-muted-foreground">
                      {b.contoh.slice(0, 2).join(", ")}
                      {b.contoh.length > 2
                        ? ` +${b.contoh.length - 2} lainnya`
                        : ""}
                    </span>
                  ) : null}
                </th>
                <td className="tabular py-2 pr-3 text-right font-semibold">
                  {bilangan(b.minimum)}
                </td>
                <td className="tabular py-2 text-right">
                  {b.akun === 0 ? "—" : `${b.akun} akun`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
