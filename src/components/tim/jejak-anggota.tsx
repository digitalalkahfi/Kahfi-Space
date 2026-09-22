import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { jamWib, tanggalPendek } from "@/lib/format";
import type { JejakAnggota } from "@/lib/data/anggota";

const JUDUL_AKSI: Record<JejakAnggota["aksi"], string> = {
  insert: "Ditambahkan",
  update: "Diubah",
  delete: "Dihapus",
};

/**
 * Riwayat perubahan data kepegawaian.
 *
 * Peran, unit, atasan, dan status menentukan wewenang seseorang — yang
 * ditampilkan di sini bukan sekadar "pernah diubah", melainkan dari apa
 * menjadi apa, oleh siapa, dan kapan.
 */
export function JejakAnggotaKartu({ jejak }: { jejak: JejakAnggota[] }) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <History className="size-4 text-muted-foreground" />
          Riwayat perubahan
        </h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          Perubahan peran, unit, atasan, dan status terekam otomatis.
        </p>
      </div>

      {jejak.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada perubahan yang terekam.
        </p>
      ) : (
        <ol className="space-y-2 px-5">
          {jejak.map((j) => (
            <li key={j.id} className="rounded-2xl bg-muted/50 p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] leading-[18px] font-semibold">
                  {JUDUL_AKSI[j.aksi]}
                  {j.olehNama ? ` oleh ${j.olehNama}` : ""}
                </span>
                <span className="text-[11px] leading-[14px] text-muted-foreground">
                  {tanggalPendek(j.waktu.slice(0, 10))} · {jamWib(j.waktu)}
                </span>
              </div>

              {j.perubahan.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5">
                  {j.perubahan.map((p) => (
                    <li
                      key={p.label}
                      className="text-[11px] leading-[14px] text-muted-foreground"
                    >
                      <span className="font-semibold text-foreground">
                        {p.label}
                      </span>{" "}
                      {p.dari} → {p.ke}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
