import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bilangan } from "@/lib/format";
import type { TautanOrang } from "@/lib/data/resolusi";

/**
 * Orang yang sudah tertaut, dengan yang lemah disebut lebih dulu.
 *
 * Tautan lewat surel praktis pasti benar. Tautan lewat nama tidak: dua
 * orang bisa bernama sama, dan satu orang bisa berganti nama. Salah
 * tautan tidak menimbulkan galat apa pun — laporannya tetap masuk, hanya
 * menempel pada orang yang keliru — dan baru ketahuan ketika seseorang
 * dinilai atas pekerjaan orang lain.
 */
export function PanelTautanOrang({ daftar }: { daftar: TautanOrang[] }) {
  const lewatNama = daftar.filter((t) => t.cara === "nama");

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Sudah tertaut</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {bilangan(daftar.length)} orang sudah punya padanan.
          {lewatNama.length > 0
            ? ` ${bilangan(lewatNama.length)} di antaranya tertaut lewat kemiripan nama — itu yang perlu ditinjau, karena nama tidak menjamin orang yang sama.`
            : " Semuanya lewat surel, yang praktis tidak mungkin keliru."}
        </p>
      </div>

      {daftar.length > 0 ? (
        <ul className="space-y-1 px-5">
          {daftar.slice(0, 40).map((t) => (
            <li
              key={t.idLama}
              className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-[18px]">
                  {t.namaLama || t.idLama} → {t.namaBaru}
                </span>
                <span className="block font-mono text-[11px] leading-[14px] text-muted-foreground">
                  {t.idLama}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-semibold",
                  t.cara === "email"
                    ? "bg-ok-fill text-ok-text"
                    : "bg-warn-fill text-warn-text",
                )}
              >
                {t.cara === "email" ? "lewat surel" : "lewat nama"}
              </span>
              {t.tersimpan ? (
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-muted-foreground">
                  tersimpan
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {daftar.length > 40 ? (
        <p className="mx-5 text-[11px] leading-[14px] text-muted-foreground">
          dan {bilangan(daftar.length - 40)} lainnya.
        </p>
      ) : null}
    </Card>
  );
}
