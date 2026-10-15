import { Card } from "@/components/ui/card";
import { keTanggalWib, tanggalPendek } from "@/lib/format";
import type { JejakLevel } from "@/lib/data/kepatuhan";

/**
 * Riwayat level (§5.2 no. 7), dari `jejakLevel` yang sudah ada
 * (`account_level_events`, terbaru lebih dulu): tanggal, dari level,
 * ke level, oleh siapa.
 */
export function RiwayatLevelAkun({ jejak }: { jejak: JejakLevel[] }) {
  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-2 px-5">
        <h2 className="text-[15px] leading-5 font-semibold">Riwayat level</h2>
        {jejak.length === 0 ? (
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Belum ada perubahan level yang tercatat.
          </p>
        ) : (
          <ol className="space-y-1.5 border-l border-border-subtle pl-3">
            {jejak.map((j) => (
              <li key={j.id} className="text-[12px] leading-4">
                <span className="tabular font-semibold">
                  {j.dari === null
                    ? `Ditetapkan level ${j.ke ?? "—"}`
                    : j.ke === null
                      ? `Level ${j.dari} dicabut`
                      : `Level ${j.dari} → ${j.ke}`}
                </span>
                <span className="text-muted-foreground">
                  {" · "}
                  {tanggalPendek(keTanggalWib(j.pada))}
                  {j.olehNama ? ` · oleh ${j.olehNama}` : ""}
                  {j.alasan ? ` · ${j.alasan}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
